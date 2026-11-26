const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redis");

// ─────────────────────────────────────────────────────────────
//  The Queue is just a "job inbox" backed by Redis.
//  Adding a job is instantaneous — it's just a Redis ZADD.
//  The heavy work happens in the Worker (emailWorker.js),
//  which runs in a completely separate process.
// ─────────────────────────────────────────────────────────────
const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,           // retry up to 3 times on failure
    backoff: {
      type: "exponential",
      delay: 2000,         // 2s, 4s, 8s back-off
    },
    removeOnComplete: 100, // keep last 100 completed jobs for inspection
    removeOnFail: 50,      // keep last 50 failed jobs for debugging
  },
});

emailQueue.on("error", (err) => {
  console.error("❌ Queue error:", err.message);
});

module.exports = { emailQueue };
