const express = require("express");

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────────
//  Simulated "send email" function — takes 4 seconds
//  In real life this could be: calling an SMTP server,
//  generating a PDF report, resizing an image, etc.
// ─────────────────────────────────────────────────────────────
function sendWelcomeEmail(user) {
  console.log(`📧 [${timestamp()}] Sending welcome email to ${user.email} ...`);

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`✅ [${timestamp()}] Email sent to ${user.email}`);
      resolve({ success: true });
    }, 4000); // 4-second artificial delay
  });
}

// ─────────────────────────────────────────────────────────────
//  POST /register
//  PROBLEM: We await the email BEFORE responding to the client.
//  The client is stuck waiting for 4 seconds doing nothing.
//  Imagine 100 concurrent users — your server thread pool
//  gets exhausted and new requests start timing out.
// ─────────────────────────────────────────────────────────────
app.post("/register", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  console.log(`\n🔵 [${timestamp()}] Register request received for: ${email}`);

  // ⚠️  BOTTLENECK: Client waits here until email is fully sent
  await sendWelcomeEmail({ name, email });

  console.log(`🔵 [${timestamp()}] Response sent to client for: ${email}\n`);

  res.status(201).json({
    message: "User registered successfully!",
    user: { name, email },
    note: "⚠️  You waited ~4 seconds for this response. That's the problem.",
  });
});

// ─────────────────────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", phase: "1 — Synchronous (slow)" });
});

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Phase 1 (Sync) server running on http://localhost:${PORT}`);
  console.log(`   Try: POST /register  { "name": "Alice", "email": "alice@example.com" }`);
  console.log(`   Watch how long the curl/Postman request hangs!\n`);
});
