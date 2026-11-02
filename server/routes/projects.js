const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");
const {
  buildRepositoryAnalysis,
  CODE_EXTENSIONS,
  getExtension,
} = require("../lib/astEngine");

const router = express.Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "archon_ast_engine_secret_key_change_in_production";

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({
        error: "MISSING_TOKEN",
        message: "Authentication required. Please sign in.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      workspaceSlug: decoded.workspaceSlug,
    };
    return next();
  } catch {
    return res.status(401).json({
      error: "INVALID_TOKEN",
      message: "Session expired or invalid. Please sign in again.",
    });
  }
}

/**
 * Parse a GitHub input like "https://github.com/owner/repo" or "owner/repo"
 */
function parseGithubInput(input) {
  const cleaned = String(input || "")
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");

  const urlMatch = cleaned.match(
    /github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      fullName: `${urlMatch[1]}/${urlMatch[2]}`,
      repoUrl: `https://github.com/${urlMatch[1]}/${urlMatch[2]}`,
    };
  }

  const slugMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slugMatch) {
    return {
      owner: slugMatch[1],
      repo: slugMatch[2],
      fullName: `${slugMatch[1]}/${slugMatch[2]}`,
      repoUrl: `https://github.com/${slugMatch[1]}/${slugMatch[2]}`,
    };
  }

  return null;
}

/**
 * Built-in multi-file codebase sources for quick-start templates (and fallback)
 * Parsed genuinely through @babel/parser AST engine!
 */
function getTemplateSourceFiles(slug) {
  if (slug === "archon/self-workspace") {
    // Read actual source files from our live project on disk!
    const rootDir = path.join(__dirname, "..", "..");
    const filesToRead = [
      "server/server.js",
      "server/lib/prisma.js",
      "server/lib/astEngine.js",
      "server/routes/auth.js",
      "client/src/app/page.js",
      "client/src/app/login/page.js",
      "client/src/app/signup/page.js",
      "client/src/components/Navbar.js",
      "client/src/components/ProductPreview.js",
      "client/src/components/FeatureTabs.js",
      "client/src/components/LoadingScreen.js",
      "client/src/components/AuthShell.js",
    ];
    const sourceFiles = [];
    for (const relPath of filesToRead) {
      const abs = path.join(rootDir, relPath);
      if (fs.existsSync(abs)) {
        sourceFiles.push({
          path: relPath,
          content: fs.readFileSync(abs, "utf8"),
        });
      }
    }
    const pkgList = [];
    for (const p of ["server/package.json", "client/package.json"]) {
      const abs = path.join(rootDir, p);
      if (fs.existsSync(abs)) {
        pkgList.push(fs.readFileSync(abs, "utf8"));
      }
    }
    return {
      repoName: "archon-workspace",
      fullName: "archon/self-workspace",
      repoUrl: "https://github.com/archon/self-workspace",
      description:
        "Archon Codebase Intelligence Platform — Express + Prisma + NeonDB + Next.js + GSAP.",
      defaultBranch: "main",
      sourceFiles,
      packageJsonList: pkgList,
    };
  }

  // Default rich multi-module TypeScript architecture parsed via Babel AST
  return {
    repoName: slug.split("/")[1] || "storefront-api",
    fullName: slug || "acme/storefront-api",
    repoUrl: `https://github.com/${slug || "acme/storefront-api"}`,
    description:
      "Production commerce API with Stripe payment processing, inventory locks, order orchestration, and JWT session middleware.",
    defaultBranch: "main",
    packageJsonList: [
      JSON.stringify({
        name: slug || "acme-storefront-api",
        version: "2.4.0",
        dependencies: {
          express: "^5.1.0",
          "@prisma/client": "^6.5.0",
          stripe: "^17.4.0",
          zod: "^3.24.2",
          ioredis: "^5.4.1",
          jsonwebtoken: "^9.0.2",
          bcryptjs: "^3.0.2",
          pino: "^9.6.0",
        },
        devDependencies: {
          typescript: "^5.7.3",
          vitest: "^3.0.5",
          prisma: "^6.5.0",
          eslint: "^9.19.0",
        },
      }),
    ],
    sourceFiles: [
      {
        path: "src/lib/db.ts",
        content: `import { PrismaClient } from "@prisma/client";
import { logEvent, logError } from "./logger";

const prisma = new PrismaClient();

export async function queryDatabase(table: string, filter: Record<string, any>) {
  if (!table) {
    logError("Missing table name in queryDatabase", { filter });
    throw new Error("Table name is required");
  }
  logEvent("db.query", { table });
  return prisma.$queryRawUnsafe(table, filter);
}

export async function withTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await prisma.$transaction(async (tx) => {
      return await work(tx);
    });
    logEvent("db.tx.commit", { elapsedMs: Date.now() - startedAt });
    return result;
  } catch (err) {
    logError("db.tx.rollback", { error: String(err) });
    throw err;
  }
}

export async function findUserRecord(userId: string) {
  if (!userId || userId.length < 4) {
    return null;
  }
  return queryDatabase("users", { id: userId });
}
`,
      },
      {
        path: "src/lib/logger.ts",
        content: `import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export function logEvent(event: string, payload: Record<string, any> = {}) {
  if (process.env.NODE_ENV === "test") return;
  logger.info({ event, timestamp: Date.now(), ...payload });
}

export function logError(message: string, context: Record<string, any> = {}) {
  const severity = context.fatal ? "fatal" : "error";
  if (severity === "fatal") {
    logger.fatal({ message, ...context });
  } else {
    logger.error({ message, ...context });
  }
}

export function formatTraceId(prefix = "trc"): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return \`\${prefix}_\${Date.now()}_\${randomPart}\`;
}
`,
      },
      {
        path: "src/middleware/session.ts",
        content: `import jwt from "jsonwebtoken";
import { findUserRecord } from "../lib/db";
import { logEvent, logError } from "../lib/logger";

const SECRET = process.env.JWT_SECRET || "session_secret";

export async function verifySessionToken(token: string) {
  if (!token || !token.startsWith("Bearer ")) {
    return null;
  }
  try {
    const raw = token.slice(7).trim();
    const decoded = jwt.verify(raw, SECRET) as { sub: string; role?: string };
    const user = await findUserRecord(decoded.sub);
    if (!user) {
      logError("Session user not found", { userId: decoded.sub });
      return null;
    }
    logEvent("auth.session.verified", { userId: decoded.sub });
    return user;
  } catch (err) {
    logError("Invalid JWT token", { err: String(err) });
    return null;
  }
}

export function requireRole(allowedRoles: string[]) {
  return async function roleGuard(req: any, res: any, next: any) {
    const user = await verifySessionToken(req.headers?.authorization || "");
    if (!user) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    req.user = user;
    return next();
  };
}
`,
      },
      {
        path: "src/services/payments.ts",
        content: `import Stripe from "stripe";
import { withTransaction, queryDatabase } from "../lib/db";
import { logEvent, logError, formatTraceId } from "../lib/logger";
import { sendReceiptEmail } from "./notifications";

const stripe = new Stripe(process.env.STRIPE_KEY || "sk_test_123");

export async function chargeCustomer(
  customerId: string,
  amountCents: number,
  currency: string = "usd",
  idempotencyKey?: string
) {
  const traceId = formatTraceId("pay");
  if (amountCents <= 0) {
    throw new Error("Charge amount must be positive");
  }
  if (amountCents > 5000000) {
    logError("High value charge blocked for manual review", { customerId, amountCents, traceId });
    throw new Error("Amount exceeds automatic limit");
  }

  return withTransaction(async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logEvent("stripe.charge.attempt", { customerId, amountCents, attempt, traceId });
        const intent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency,
          customer: customerId,
          confirm: true,
        });

        await queryDatabase("payments", {
          intentId: intent.id,
          status: intent.status,
          traceId,
        });

        if (intent.status === "succeeded") {
          await sendReceiptEmail(customerId, amountCents, intent.id);
          return { ok: true, intentId: intent.id, traceId };
        }
      } catch (err: any) {
        logError("Stripe charge attempt failed", { attempt, code: err?.code, traceId });
        if (attempt === 3 || err?.code === "card_declined") {
          throw err;
        }
      }
    }
    throw new Error("Payment retries exhausted");
  });
}

export async function issueRefund(paymentIntentId: string, reason?: string) {
  if (!paymentIntentId) {
    throw new Error("Missing paymentIntentId");
  }
  logEvent("stripe.refund.requested", { paymentIntentId, reason });
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  await queryDatabase("refunds", { refundId: refund.id, paymentIntentId });
  return refund;
}
`,
      },
      {
        path: "src/services/inventory.ts",
        content: `import Redis from "ioredis";
import { queryDatabase, withTransaction } from "../lib/db";
import { logEvent, logError } from "../lib/logger";

const redis = new Redis();

export async function reserveInventoryStock(sku: string, quantity: number) {
  if (!sku || quantity <= 0) {
    throw new Error("Invalid SKU or quantity");
  }
  const lockKey = \`lock:inventory:\${sku}\`;
  const locked = await redis.set(lockKey, "1", "EX", 15, "NX");
  if (!locked) {
    logError("Inventory lock contention", { sku, quantity });
    throw new Error("SKU is currently locked by another checkout");
  }

  try {
    return await withTransaction(async () => {
      const stock = await queryDatabase("inventory", { sku });
      logEvent("inventory.reserved", { sku, quantity });
      return { reserved: true, sku, quantity, remaining: (stock?.available || 100) - quantity };
    });
  } finally {
    await redis.del(lockKey);
  }
}

export async function releaseInventoryHold(sku: string, quantity: number) {
  logEvent("inventory.released", { sku, quantity });
  return queryDatabase("inventory_releases", { sku, quantity });
}
`,
      },
      {
        path: "src/services/orders.ts",
        content: `import { withTransaction, queryDatabase } from "../lib/db";
import { reserveInventoryStock, releaseInventoryHold } from "./inventory";
import { chargeCustomer, issueRefund } from "./payments";
import { sendOrderConfirmation } from "./notifications";
import { logEvent, logError, formatTraceId } from "../lib/logger";

export async function createOrderWorkflow(userId: string, items: Array<{ sku: string; qty: number; priceCents: number }>) {
  const orderTrace = formatTraceId("ord");
  if (!userId || !items || items.length === 0) {
    throw new Error("Order requires a valid userId and at least one item");
  }

  let totalCents = 0;
  for (const item of items) {
    if (item.qty <= 0 || item.priceCents < 0) {
      throw new Error("Invalid line item quantity or price");
    }
    totalCents += item.qty * item.priceCents;
    await reserveInventoryStock(item.sku, item.qty);
  }

  try {
    const payment = await chargeCustomer(userId, totalCents, "usd", orderTrace);
    const order = await withTransaction(async () => {
      return queryDatabase("orders", {
        userId,
        totalCents,
        intentId: payment.intentId,
        status: "PAID",
      });
    });

    await sendOrderConfirmation(userId, orderTrace, totalCents);
    logEvent("order.completed", { orderTrace, totalCents });
    return { orderId: orderTrace, totalCents, paymentIntent: payment.intentId };
  } catch (err) {
    logError("Order failed, rolling back inventory holds", { orderTrace, err: String(err) });
    for (const item of items) {
      await releaseInventoryHold(item.sku, item.qty);
    }
    throw err;
  }
}

export async function cancelExistingOrder(orderId: string, paymentIntentId: string) {
  logEvent("order.cancel.start", { orderId });
  await issueRefund(paymentIntentId, "customer_cancelled");
  return queryDatabase("orders_cancel", { orderId, status: "CANCELLED" });
}
`,
      },
      {
        path: "src/services/notifications.ts",
        content: `import { logEvent, logError } from "../lib/logger";
import { queryDatabase } from "../lib/db";

export async function sendReceiptEmail(customerId: string, amountCents: number, intentId: string) {
  if (!customerId) {
    logError("Cannot send receipt without customerId", { intentId });
    return false;
  }
  logEvent("email.receipt.sent", { customerId, amountCents, intentId });
  await queryDatabase("email_outbox", { type: "RECEIPT", customerId, intentId });
  return true;
}

export async function sendOrderConfirmation(userId: string, orderId: string, totalCents: number) {
  logEvent("email.order_confirmation.sent", { userId, orderId, totalCents });
  await queryDatabase("email_outbox", { type: "ORDER_CONFIRMATION", userId, orderId });
  return true;
}
`,
      },
      {
        path: "src/routes/checkout.ts",
        content: `import { z } from "zod";
import { verifySessionToken } from "../middleware/session";
import { createOrderWorkflow, cancelExistingOrder } from "../services/orders";
import { logEvent, logError } from "../lib/logger";

const CheckoutSchema = z.object({
  items: z.array(z.object({ sku: z.string(), qty: z.number(), priceCents: z.number() })),
});

export async function handleCheckoutPost(req: any, res: any) {
  const user = await verifySessionToken(req.headers?.authorization || "");
  if (!user) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  const parsed = CheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    logError("Checkout payload validation failed", { issues: parsed.error.issues });
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  try {
    logEvent("route.checkout.start", { userId: user.id });
    const result = await createOrderWorkflow(user.id, parsed.data.items);
    return res.status(201).json({ status: "CONFIRMED", ...result });
  } catch (err: any) {
    logError("Checkout route error", { message: err?.message });
    return res.status(500).json({ error: "CHECKOUT_FAILED", message: err?.message });
  }
}

export async function handleCancelOrderPost(req: any, res: any) {
  const user = await verifySessionToken(req.headers?.authorization || "");
  if (!user) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
  const { orderId, paymentIntentId } = req.body || {};
  const result = await cancelExistingOrder(orderId, paymentIntentId);
  return res.status(200).json({ status: "CANCELLED", result });
}
`,
      },
    ],
  };
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".turbo",
  ".cache",
]);

function walkDirectory(dir, baseDir, collected = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return collected;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, absPath).split(path.sep).join("/");

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walkDirectory(absPath, baseDir, collected);
      }
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = fs.statSync(absPath).size;
      } catch {
        size = 0;
      }
      collected.push({ absPath, relPath, size });
    }
  }
  return collected;
}

function extractDescriptionFromReadme(readmeText) {
  if (!readmeText) return "";
  const lines = readmeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("#") &&
        !l.startsWith("!") &&
        !l.startsWith("[!") &&
        !l.startsWith("<") &&
        !l.startsWith("```") &&
        !l.startsWith("---") &&
        l.length > 20
    );
  if (!lines.length) return "";
  const first = lines[0].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return first.length > 200 ? first.slice(0, 197) + "..." : first;
}

/**
 * Fetch repository files directly via GitHub's codeload tarball stream.
 * Immune to api.github.com's 60 req/hr unauthenticated REST rate limit!
 */
async function fetchGithubRepositoryFiles(owner, repo) {
  const archiveUrl = `https://codeload.github.com/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}/tar.gz/HEAD`;

  const archiveRes = await fetch(archiveUrl, {
    headers: {
      "User-Agent": "Archon-AST-Analyzer/2.5",
    },
    signal: AbortSignal.timeout(25000),
  });

  if (archiveRes.status === 404) {
    const err = new Error(
      `Repository "${owner}/${repo}" was not found on GitHub (or is private). Make sure the URL is spelled correctly and the repository is public.`
    );
    err.statusCode = 404;
    err.errorCode = "REPO_NOT_FOUND";
    throw err;
  }

  if (!archiveRes.ok) {
    const err = new Error(
      `GitHub archive download returned HTTP ${archiveRes.status} for "${owner}/${repo}".`
    );
    err.statusCode = 502;
    err.errorCode = "GITHUB_DOWNLOAD_FAILED";
    throw err;
  }

  // Detect default branch via git ls-remote (does not use REST API quota)
  let defaultBranch = "main";
  try {
    const lsOut = execFileSync(
      "git",
      [
        "ls-remote",
        "--symref",
        `https://github.com/${owner}/${repo}.git`,
        "HEAD",
      ],
      { encoding: "utf8", timeout: 4500, stdio: ["ignore", "pipe", "ignore"] }
    );
    const branchMatch = lsOut.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/);
    if (branchMatch?.[1]) {
      defaultBranch = branchMatch[1];
    }
  } catch {
    // keep default "main"
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "archon-repo-"));
  const tarPath = path.join(tmpDir, "repo.tar.gz");
  const extractDir = path.join(tmpDir, "extracted");
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    const arrayBuf = await archiveRes.arrayBuffer();
    fs.writeFileSync(tarPath, Buffer.from(arrayBuf));

    execFileSync("tar", ["-xzf", tarPath, "-C", extractDir], {
      timeout: 15000,
    });

    const topEntries = fs
      .readdirSync(extractDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    const repoRoot =
      topEntries.length === 1
        ? path.join(extractDir, topEntries[0].name)
        : extractDir;

    const allFiles = walkDirectory(repoRoot, repoRoot);

    // 1. Extract manifest files (package.json, requirements.txt)
    const packageJsonList = [];
    let requirementsTxt = "";
    let pkgDescription = "";

    const manifestFiles = allFiles
      .filter(
        (f) =>
          f.relPath.endsWith("package.json") ||
          f.relPath.endsWith("requirements.txt")
      )
      .slice(0, 6);

    for (const mf of manifestFiles) {
      try {
        const content = fs.readFileSync(mf.absPath, "utf8");
        if (mf.relPath.endsWith("package.json")) {
          packageJsonList.push(content);
          if (!pkgDescription) {
            try {
              const parsedPkg = JSON.parse(content);
              if (parsedPkg.description) pkgDescription = parsedPkg.description;
            } catch {
              // ignore
            }
          }
        } else if (mf.relPath.endsWith("requirements.txt")) {
          requirementsTxt += "\n" + content;
        }
      } catch {
        // ignore
      }
    }

    // 2. Extract description from README if available
    let readmeDescription = "";
    const readmeEntry = allFiles.find(
      (f) => f.relPath.toLowerCase() === "readme.md"
    );
    if (readmeEntry && readmeEntry.size < 250000) {
      try {
        readmeDescription = extractDescriptionFromReadme(
          fs.readFileSync(readmeEntry.absPath, "utf8")
        );
      } catch {
        // ignore
      }
    }

    // 3. Select and read source code files
    const codeEntries = allFiles
      .filter((f) => {
        const ext = getExtension(f.relPath);
        if (!CODE_EXTENSIONS[ext]) return false;
        if (
          f.relPath.endsWith(".min.js") ||
          f.relPath.endsWith(".bundle.js") ||
          f.relPath.endsWith(".d.ts")
        ) {
          return false;
        }
        const maxBytes = ext === ".ipynb" ? 3000000 : 300000;
        return f.size > 0 && f.size <= maxBytes;
      })
      .sort((a, b) => {
        const priority = (p) =>
          p.startsWith("src/") ||
          p.startsWith("app/") ||
          p.startsWith("server/") ||
          p.startsWith("client/src/") ||
          p.startsWith("components/") ||
          p.startsWith("pages/") ||
          p.startsWith("lib/") ||
          p.startsWith("notebooks/")
            ? 0
            : 1;
        return priority(a.relPath) - priority(b.relPath);
      })
      .slice(0, 75);

    const validSourceFiles = [];
    for (const entry of codeEntries) {
      try {
        const content = fs.readFileSync(entry.absPath, "utf8");
        validSourceFiles.push({ path: entry.relPath, content });
      } catch {
        // ignore unreadable file
      }
    }

    if (validSourceFiles.length === 0) {
      const err = new Error(
        `Repository "${owner}/${repo}" contains no supported code files (.js, .jsx, .ts, .tsx, .py, .ipynb, .go, .rs, .java).`
      );
      err.statusCode = 422;
      err.errorCode = "NO_SUPPORTED_FILES";
      throw err;
    }

    return {
      repoName: repo,
      fullName: `${owner}/${repo}`,
      repoUrl: `https://github.com/${owner}/${repo}`,
      description: pkgDescription || readmeDescription || "",
      defaultBranch,
      sourceFiles: validSourceFiles,
      packageJsonList,
      requirementsTxt,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}

// GET /api/projects — List all projects for current user
router.get("/", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const projects = await prisma.repository.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        fullName: true,
        repoUrl: true,
        description: true,
        defaultBranch: true,
        primaryLanguage: true,
        fileCount: true,
        functionCount: true,
        packageCount: true,
        dependencyCount: true,
        totalLines: true,
        astNodeCount: true,
        healthScore: true,
        status: true,
        lastIndexedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      status: "OK",
      projects,
    });
  } catch (err) {
    console.error("[GET /api/projects ERROR]:", err);
    return res.status(500).json({
      error: "DATABASE_ERROR",
      message: "Unable to load your projects right now.",
    });
  }
});

// GET /api/projects/:id — Fetch single project with full AST analysisData
router.get("/:id", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const project = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: "PROJECT_NOT_FOUND",
        message: "Project not found in your workspace.",
      });
    }

    return res.status(200).json({
      status: "OK",
      project,
    });
  } catch (err) {
    console.error("[GET /api/projects/:id ERROR]:", err);
    return res.status(500).json({
      error: "DATABASE_ERROR",
      message: "Unable to load project analysis.",
    });
  }
});

// POST /api/projects/analyze — Connect & parse a repository using the AST Engine
router.post("/analyze", requireAuth, async (req, res) => {
  try {
    const { repoUrl, preset } = req.body || {};
    const targetInput = preset || repoUrl;

    if (!targetInput) {
      return res.status(400).json({
        error: "MISSING_REPO",
        message: "Please provide a GitHub repository URL or select a preset.",
      });
    }

    const parsedGh = parseGithubInput(targetInput);
    if (!parsedGh) {
      return res.status(400).json({
        error: "INVALID_REPO_URL",
        message:
          "Enter a valid GitHub repository URL (e.g. https://github.com/owner/repo or owner/repo).",
      });
    }

    let rawRepoBundle = null;

    // Only explicit built-in presets use template files; real GitHub URLs ALWAYS fetch the real repository!
    if (
      parsedGh.fullName === "archon/self-workspace" ||
      parsedGh.fullName === "acme/storefront-api"
    ) {
      rawRepoBundle = getTemplateSourceFiles(parsedGh.fullName);
    } else {
      rawRepoBundle = await fetchGithubRepositoryFiles(
        parsedGh.owner,
        parsedGh.repo
      );
    }

    // Run Babel AST Engine on the source files
    const analysis = buildRepositoryAnalysis(rawRepoBundle);

    const projectPayload = {
      name: analysis.repoName,
      fullName: analysis.fullName,
      repoUrl: analysis.repoUrl,
      description: analysis.description,
      defaultBranch: analysis.defaultBranch,
      primaryLanguage: analysis.primaryLanguage,
      fileCount: analysis.fileCount,
      functionCount: analysis.functionCount,
      packageCount: analysis.packageCount,
      dependencyCount: analysis.dependencyCount,
      totalLines: analysis.totalLines,
      astNodeCount: analysis.astNodeCount,
      healthScore: analysis.healthScore,
      status: "READY",
      analysisData: analysis,
      lastIndexedAt: new Date(),
    };

    // Upsert for this user + fullName so re-analyzing updates cleanly instead of leaving stale duplicates
    const existingProject = await prisma.repository.findFirst({
      where: {
        userId: req.user.id,
        fullName: {
          equals: analysis.fullName,
          mode: "insensitive",
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let savedProject;
    if (existingProject) {
      savedProject = await prisma.repository.update({
        where: { id: existingProject.id },
        data: projectPayload,
      });
    } else {
      savedProject = await prisma.repository.create({
        data: {
          ...projectPayload,
          userId: req.user.id,
        },
      });
    }

    return res.status(201).json({
      status: "INDEXED",
      project: savedProject,
    });
  } catch (err) {
    console.error("[POST /api/projects/analyze ERROR]:", err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.errorCode || "ANALYSIS_FAILED",
      message:
        err.message || "Failed to parse repository AST. Please try again.",
    });
  }
});

// DELETE /api/projects/:id — Remove a project
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Project not found.",
      });
    }

    await prisma.repository.delete({ where: { id: existing.id } });
    return res.status(200).json({ status: "DELETED", id: existing.id });
  } catch (err) {
    console.error("[DELETE /api/projects/:id ERROR]:", err);
    return res.status(500).json({
      error: "DELETE_FAILED",
      message: "Unable to delete project.",
    });
  }
});

module.exports = router;

