const { Worker } = require("bullmq");
const { redisConnection } = require("../config/redis");

// ─────────────────────────────────────────────────────────────
//  This file is a SEPARATE PROCESS from the API server.
//  Run it with:  npm run worker
//
//  The Worker listens to the "email-queue" and processes
//  jobs one by one (or in parallel — configurable via
//  the `concurrency` option below).
//
//  KEY INSIGHT: The API server doesn't wait for this code.
//  The HTTP request completes in milliseconds; the Worker
//  does the heavy lifting asynchronously in the background.
// ─────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

// ── Simulated email sending (same 4-second delay as Phase 1) ──
async function sendWelcomeEmail(user) {
  console.log(`📧 [${timestamp()}] Processing email job for ${user.email} ...`);

  await new Promise((resolve) => setTimeout(resolve, 4000)); // 4-second delay

  console.log(`✅ [${timestamp()}] Email delivered to ${user.email}`);
  return { delivered: true, to: user.email };
}

// ── Worker definition ─────────────────────────────────────────
const worker = new Worker(
  "email-queue",
  async (job) => {
    console.log(`\n⚙️  [${timestamp()}] Job #${job.id} picked up — type: ${job.name}`);

    switch (job.name) {
      case "send-welcome-email":
        return await sendWelcomeEmail(job.data);

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // process up to 5 jobs simultaneously
                    // try changing this to 1 and hammering /register
  }
);

// ── Lifecycle events (great for observability / logging) ──────
worker.on("completed", (job, result) => {
  console.log(`🎉 [${timestamp()}] Job #${job.id} completed:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`💥 [${timestamp()}] Job #${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err.message);
});

console.log("🏭  Email Worker started — listening for jobs on 'email-queue'");
console.log("    Concurrency:", 5);
