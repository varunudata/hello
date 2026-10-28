const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  findUserByEmailOrSlug,
  findUserById,
  createUserRecord,
} = require("../lib/prisma");

const router = express.Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "archon_ast_engine_secret_key_change_in_production";

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    workspaceSlug: user.workspaceSlug,
    role: user.role || "ENGINEER",
    createdAt: user.createdAt,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      workspaceSlug: user.workspaceSlug,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, workspaceSlug } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Name, work email, and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        error: "INVALID_EMAIL",
        message: "Please provide a valid email address.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "WEAK_CREDENTIALS",
        message: "Password must be at least 8 characters long.",
      });
    }

    const rawSlug =
      workspaceSlug ||
      normalizedEmail.split("@")[0].replace(/[^a-z0-9-]/gi, "-");
    const cleanSlug = String(rawSlug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug || cleanSlug.length < 2) {
      return res.status(400).json({
        error: "INVALID_WORKSPACE_SLUG",
        message: "Workspace identifier must contain at least 2 alphanumeric characters.",
      });
    }

    const existingEmail = await findUserByEmailOrSlug({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({
        error: "EMAIL_TAKEN",
        message: "An account with this email already exists. Try logging in instead.",
      });
    }

    // An explicitly chosen slug must be free; a derived one gets a short suffix on collision.
    let finalSlug = cleanSlug;
    if (workspaceSlug) {
      if (await findUserByEmailOrSlug({ workspaceSlug: finalSlug })) {
        return res.status(409).json({
          error: "SLUG_TAKEN",
          message: "That workspace name is already taken.",
        });
      }
    } else {
      for (let i = 0; i < 5 && (await findUserByEmailOrSlug({ workspaceSlug: finalSlug })); i++) {
        finalSlug = `${cleanSlug}-${crypto.randomBytes(2).toString("hex")}`;
      }
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const { user, engine } = await createUserRecord({
      email: normalizedEmail,
      name: String(name).trim(),
      passwordHash,
      workspaceSlug: finalSlug,
    });

    const token = signToken(user);

    return res.status(201).json({
      status: "PROVISIONED",
      engine,
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("[AUTH SIGNUP ERROR]:", err);
    return res.status(500).json({
      error: "INTERNAL_ENGINE_ERROR",
      message: "Unable to provision workspace right now.",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Email and password are required to authenticate.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await findUserByEmailOrSlug({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        error: "AUTH_REJECTED",
        message: "Incorrect email or password.",
      });
    }

    const validPassword = await bcrypt.compare(
      String(password),
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "AUTH_REJECTED",
        message: "Incorrect email or password.",
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      status: "AUTHENTICATED",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("[AUTH LOGIN ERROR]:", err);
    return res.status(500).json({
      error: "INTERNAL_ENGINE_ERROR",
      message: "Authentication service encountered an unexpected fault.",
    });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({
        error: "MISSING_TOKEN",
        message: "Session bearer token required.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.sub);

    if (!user) {
      return res.status(401).json({
        error: "SESSION_EXPIRED",
        message: "Identity record no longer exists.",
      });
    }

    return res.status(200).json({
      status: "ACTIVE",
      user: sanitizeUser(user),
    });
  } catch {
    return res.status(401).json({
      error: "INVALID_TOKEN",
      message: "Session token is invalid or expired.",
    });
  }
});

module.exports = router;

