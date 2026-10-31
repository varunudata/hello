const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const isPlaceholderUrl = () => {
  const url = process.env.DATABASE_URL || "";
  return !url || url.includes("YOUR_PASSWORD") || url.includes("ep-example");
};

// Local fallback persistence used ONLY until the user supplies their live NeonDB URL in .env
const fallbackFilePath = path.join(__dirname, "..", ".data", "users.json");

function readFallbackUsers() {
  try {
    if (!fs.existsSync(fallbackFilePath)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(fallbackFilePath, "utf8"));
  } catch {
    return [];
  }
}

function writeFallbackUsers(users) {
  const dir = path.dirname(fallbackFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fallbackFilePath, JSON.stringify(users, null, 2), "utf8");
}

async function findUserByEmailOrSlug({ email, workspaceSlug }) {
  if (!isPlaceholderUrl()) {
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
  }

  const users = readFallbackUsers();
  return (
    users.find(
      (u) =>
        (email && u.email.toLowerCase() === email.toLowerCase()) ||
        (workspaceSlug &&
          u.workspaceSlug.toLowerCase() === workspaceSlug.toLowerCase())
    ) || null
  );
}

async function findUserById(id) {
  if (!isPlaceholderUrl()) {
    return await prisma.user.findUnique({
      where: { id },
      include: { repositories: true },
    });
  }

  const users = readFallbackUsers();
  return users.find((u) => u.id === id) || null;
}

async function createUserRecord({ email, name, passwordHash, workspaceSlug }) {
  if (!isPlaceholderUrl()) {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        workspaceSlug,
      },
    });
    return { user, engine: "neon-postgresql" };
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
  isPlaceholderUrl,
  findUserByEmailOrSlug,
  findUserById,
  createUserRecord,
};

