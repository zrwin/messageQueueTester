const express = require("express");
const { emailQueue } = require("../jobs/emailQueue");

const router = express.Router();

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

// ─────────────────────────────────────────────────────────────
//  POST /register
//  SOLUTION: We enqueue the email job and immediately return.
//  The client gets a 202 Accepted in milliseconds.
//  The Worker picks up the job and sends the email in the background.
// ─────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  console.log(`\n🟢 [${timestamp()}] Register request received for: ${email}`);

  // ✅ Enqueue the job — this is a fast Redis write (~1ms)
  const job = await emailQueue.add("send-welcome-email", { name, email });

  console.log(`🟢 [${timestamp()}] Job #${job.id} queued — responding to client immediately`);

  // Respond right away — no waiting for email to be sent!
  res.status(202).json({
    message: "User registered! Welcome email is being sent in the background.",
    user: { name, email },
    jobId: job.id,
    note: "✅ Response in <5ms. Email is processed asynchronously by the Worker.",
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /job-status/:jobId
//  Let the client poll for the job result (optional).
//  In production you'd push this via WebSockets or webhooks.
// ─────────────────────────────────────────────────────────────
router.get("/job-status/:jobId", async (req, res) => {
  const job = await emailQueue.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const state = await job.getState(); // waiting | active | completed | failed
  const result = job.returnvalue;
  const failReason = job.failedReason;

  res.json({
    jobId: job.id,
    state,
    data: job.data,
    result: result || null,
    failReason: failReason || null,
    attempts: job.attemptsMade,
    createdAt: new Date(job.timestamp).toISOString(),
  });
});

module.exports = router;
