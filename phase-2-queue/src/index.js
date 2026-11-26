const express = require("express");
const registerRouter = require("./routes/register");

const app = express();
app.use(express.json());

// Routes
app.use("/", registerRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", phase: "2 — Message Queue (fast)" });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n🚀 Phase 2 (Queue) API server running on http://localhost:${PORT}`);
  console.log(`   Try: POST /register  { "name": "Alice", "email": "alice@example.com" }`);
  console.log(`   Make sure the Worker is also running: npm run worker\n`);
});
