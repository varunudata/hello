const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const isPlaceholderUrl = () => {
  const url = process.env.DATABASE_URL || "";
  return !url || url.includes("YOUR_PASSWORD") || url.includes("ep-example");
};

/**
 * Normalize Neon PostgreSQL connection string so serverless cold-starts
 * (which take ~6-12s when waking from auto-suspend) and PgBouncer pooling
 * never fail Prisma's default 5-second connect_timeout.
 */
function buildResilientDatabaseUrl(rawUrl) {
  if (!rawUrl || isPlaceholderUrl()) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes("-pooler.")) {
      parsed.searchParams.delete("channel_binding");
      if (!parsed.searchParams.has("pgbouncer")) {
        parsed.searchParams.set("pgbouncer", "true");
      }
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "30");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
    }
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function isTransientConnectionError(err) {
  if (!err) return false;
  const msg = String(err.message || "");
  const name = String(err.name || "");
  const code = String(err.code || err.errorCode || "");
  return (
    name.includes("PrismaClientInitializationError") ||
    name.includes("PrismaClientRustPanicError") ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017" ||
    msg.includes("Can't reach database server") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("Timed out fetching a new connection") ||
    msg.includes("Connection reset") ||
    msg.includes("Closed")
  );
}

const globalForPrisma = globalThis;

function createPrismaClient() {
  const resilientUrl = buildResilientDatabaseUrl(process.env.DATABASE_URL);
  const baseClient = new PrismaClient({
    log: ["warn"],
    ...(resilientUrl
      ? {
          datasources: {
            db: { url: resilientUrl },
          },
        }
      : {}),
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let lastErr;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              lastErr = err;
              if (!isTransientConnectionError(err) || attempt === 2) {
                throw err;
              }
              console.warn(
                `[NeonDB Connection Retry ${attempt}/2]: Reconnecting to Neon PostgreSQL...`
              );
              try {
                await baseClient.$disconnect();
              } catch {
                // ignore
              }
              await new Promise((r) => setTimeout(r, 750));
            }
          }
          throw lastErr;
        },
      },
    },
  });
}

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Local write-through mirror & offline fallback in server/.data/
const dataDir = path.join(__dirname, "..", ".data");
const fallbackUsersPath = path.join(dataDir, "users.json");
const fallbackProjectsPath = path.join(dataDir, "projects.json");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readFallbackUsers() {
  try {
    if (!fs.existsSync(fallbackUsersPath)) return [];
    return JSON.parse(fs.readFileSync(fallbackUsersPath, "utf8"));
  } catch {
    return [];
  }
}

function writeFallbackUsers(users) {
  try {
    ensureDataDir();
    fs.writeFileSync(fallbackUsersPath, JSON.stringify(users, null, 2), "utf8");
  } catch {
    // ignore
  }
}

function syncUserToLocalMirror(user) {
  if (!user || !user.id) return;
  const users = readFallbackUsers();
  const idx = users.findIndex(
    (u) =>
      u.id === user.id ||
      (user.email && u.email?.toLowerCase() === user.email.toLowerCase())
  );
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user };
  } else {
    users.push(user);
  }
  writeFallbackUsers(users);
}

function readFallbackProjects() {
  try {
    if (!fs.existsSync(fallbackProjectsPath)) return [];
    return JSON.parse(fs.readFileSync(fallbackProjectsPath, "utf8"));
  } catch {
    return [];
  }
}

function writeFallbackProjects(projects) {
  try {
    ensureDataDir();
    fs.writeFileSync(
      fallbackProjectsPath,
      JSON.stringify(projects, null, 2),
      "utf8"
    );
  } catch {
    // ignore
  }
}

function syncProjectToLocalMirror(project) {
  if (!project || !project.id) return;
  const projects = readFallbackProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = { ...projects[idx], ...project };
  } else {
    projects.unshift(project);
  }
  writeFallbackProjects(projects);
}

function withFastTimeout(promiseOrFn, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`NeonDB query exceeded ${ms}ms fast-path budget`));
    }, ms);
    Promise.resolve()
      .then(() =>
        typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn
      )
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function findUserByEmailOrSlug({ email, workspaceSlug }) {
  const users = readFallbackUsers();
  const localUser =
    users.find(
      (u) =>
        (email && u.email?.toLowerCase() === email.toLowerCase()) ||
        (workspaceSlug &&
          u.workspaceSlug?.toLowerCase() === workspaceSlug.toLowerCase())
    ) || null;

  const runDbLookup = async () => {
    if (email && workspaceSlug) {
      return await prisma.user.findFirst({
        where: {
          OR: [{ email }, { workspaceSlug }],
        },
      });
    }
    if (email) {
      return await prisma.user.findUnique({ where: { email } });
    }
    if (workspaceSlug) {
      return await prisma.user.findUnique({ where: { workspaceSlug } });
    }
    return null;
  };

  if (localUser) {
    // Refresh from NeonDB in the background without blocking login
    if (!isPlaceholderUrl()) {
      setImmediate(() => {
        runDbLookup()
          .then((u) => {
            if (u) syncUserToLocalMirror(u);
          })
          .catch(() => {});
      });
    }
    return localUser;
  }

  if (!isPlaceholderUrl()) {
    try {
      const dbUser = await withFastTimeout(runDbLookup, 4000);
      if (dbUser) {
        syncUserToLocalMirror(dbUser);
      }
      return dbUser;
    } catch (err) {
      console.warn(
        "[NeonDB slow/unreachable in findUserByEmailOrSlug — using local mirror]:",
        err.message
      );
    }
  }

  return localUser;
}

async function findUserById(id) {
  const users = readFallbackUsers();
  const localUser = users.find((u) => u.id === id) || null;

  const runDbLookup = async () =>
    await prisma.user.findUnique({
      where: { id },
      include: { repositories: true },
    });

  if (localUser) {
    if (!isPlaceholderUrl()) {
      setImmediate(() => {
        runDbLookup()
          .then((u) => {
            if (u) syncUserToLocalMirror(u);
          })
          .catch(() => {});
      });
    }
    return localUser;
  }

  if (!isPlaceholderUrl()) {
    try {
      const dbUser = await withFastTimeout(runDbLookup, 4000);
      if (dbUser) {
        syncUserToLocalMirror(dbUser);
      }
      return dbUser;
    } catch (err) {
      console.warn(
        "[NeonDB slow/unreachable in findUserById — using local mirror]:",
        err.message
      );
    }
  }

  return localUser;
}

async function createUserRecord({ email, name, passwordHash, workspaceSlug }) {
  if (!isPlaceholderUrl()) {
    try {
      const user = await withFastTimeout(
        () =>
          prisma.user.create({
            data: {
              email,
              name,
              passwordHash,
              workspaceSlug,
            },
          }),
        4500
      );
      syncUserToLocalMirror(user);
      return { user, engine: "neon-postgresql" };
    } catch (err) {
      console.warn(
        "[NeonDB slow/unreachable in createUserRecord — saving to local mirror & queueing background sync]:",
        err.message
      );
      setImmediate(() => {
        prisma.user
          .create({
            data: { email, name, passwordHash, workspaceSlug },
          })
          .then((u) => syncUserToLocalMirror(u))
          .catch(() => {});
      });
    }
  }

  const users = readFallbackUsers();
  const newUser = {
    id: "usr_" + crypto.randomBytes(8).toString("hex"),
    email,
    name,
    passwordHash,
    workspaceSlug,
    role: "ENGINEER",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repositories: [],
  };
  users.push(newUser);
  writeFallbackUsers(users);
  return { user: newUser, engine: "local-dev-store" };
}

module.exports = {
  prisma,
  withFastTimeout,
  isPlaceholderUrl,
  isTransientConnectionError,
  findUserByEmailOrSlug,
  findUserById,
  createUserRecord,
  readFallbackProjects,
  writeFallbackProjects,
  syncProjectToLocalMirror,
};
