const { createClient } = require("ioredis");

// ─────────────────────────────────────────────────────────────
//  BullMQ needs a raw ioredis connection config object.
//  We export it so both the Queue (API server) and the
//  Worker can share identical connection settings.
// ─────────────────────────────────────────────────────────────
const redisConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null, // required by BullMQ
};

module.exports = { redisConnection };
