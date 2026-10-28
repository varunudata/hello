require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const { isPlaceholderUrl } = require("./lib/prisma");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    service: "archon-ast-engine",
    version: "2.4.0",
    status: "ONLINE",
    orm: "Prisma v6 (PostgreSQL / NeonDB)",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    engine: "archon-core-v2.4",
    database: isPlaceholderUrl()
      ? "awaiting-neon-credentials (local-dev-store active)"
      : "neon-postgresql-connected",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`[ARCHON ENGINE] Server listening on http://localhost:${PORT}`);
});
