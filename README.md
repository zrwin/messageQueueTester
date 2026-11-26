# 📬 Message Queue Learning Project — Node.js

A hands-on project to understand **why** message queues exist by first feeling the pain without them.

---

## 🗂️ Structure

```
message_queue/
├── phase-1-sync/        ← The "before": slow synchronous request
│   └── index.js
└── phase-2-queue/       ← The "after": async via BullMQ + Redis
    └── src/
        ├── index.js           (API server — port 3002)
        ├── config/redis.js    (shared Redis connection config)
        ├── jobs/emailQueue.js (BullMQ Queue definition)
        ├── routes/register.js (POST /register, GET /job-status/:id)
        └── workers/emailWorker.js  (background processor — separate process)
```

---

## 🔴 Phase 1 — Synchronous (The Problem)

### What it does
`POST /register` saves the user **and** sends a welcome email **before** replying.
Since email sending takes ~4 seconds, the **HTTP client hangs** for the full duration.

### Run it
```bash
cd phase-1-sync
npm install
npm start
```

### Try it
```bash
# In another terminal — watch how long it takes
curl -s -w "\n⏱ Total time: %{time_total}s\n" \
  -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

### What you'll observe
- Response takes **~4 seconds**
- Run 10 concurrent requests and watch them queue up / pile on
- Server is **blocked** during email sending — no other work can happen on that call chain

```bash
# Stress test: 5 concurrent registrations
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3001/register \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"User$i\",\"email\":\"user$i@example.com\"}" &
done; wait
```

---

## 🟢 Phase 2 — Message Queue (The Solution)

### Prerequisites
You need **Redis** running locally:
```bash
# macOS
brew install redis && brew services start redis

# Docker (alternative)
docker run -d -p 6379:6379 redis:alpine
```

### Architecture

```
┌─────────────┐    POST /register     ┌──────────────┐
│   Client    │ ───────────────────▶  │  API Server  │  (port 3002)
│             │ ◀─────────────────── │  (index.js)  │
│  <5ms resp! │   202 Accepted        └──────┬───────┘
└─────────────┘                              │  add job (Redis ZADD ~1ms)
                                             ▼
                                      ┌──────────────┐
                                      │    Redis     │  ← job inbox
                                      │  (BullMQ)    │
                                      └──────┬───────┘
                                             │  polls for jobs
                                             ▼
                                      ┌──────────────┐
                                      │    Worker    │  (emailWorker.js)
                                      │  (separate   │  ← does the heavy work
                                      │   process)   │     in the background
                                      └──────────────┘
```

### Run it (two terminals required)

**Terminal 1 — API Server:**
```bash
cd phase-2-queue
npm install
npm start          # or: npm run dev
```

**Terminal 2 — Email Worker:**
```bash
cd phase-2-queue
npm run worker     # or: npm run worker:dev
```

### Try it
```bash
# Instant response!
curl -s -w "\n⏱ Total time: %{time_total}s\n" \
  -X POST http://localhost:3002/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

You'll get a `jobId` back. Poll for the result:
```bash
# Replace JOB_ID with the id from the response above
curl http://localhost:3002/job-status/JOB_ID
```

### Stress test — feel the difference
Use the included `test-parallel.sh` script to fire **20 parallel requests**:
```bash
./test-parallel.sh        # Phase 1 (port 3001)
./test-parallel.sh 3002   # Phase 2 (port 3002)
```

---

## 💥 What happens if you kill the server mid-run?

Killing a process (`Ctrl+C`) during `./test-parallel.sh` shows why **durability** is one of the main reasons message queues exist:

### 🔴 Phase 1 (`phase-1-sync`) — Everything is lost
- **In-flight HTTP requests fail** immediately with a connection reset.
- **In-flight emails are lost forever** because `sendWelcomeEmail` is just an in-memory `setTimeout` inside the Node.js process.
- **No record or retry** — restarting the server won't recover any of those pending emails.

### 🟢 Phase 2 (`phase-2-queue`) — Jobs survive in Redis
Because the **API server**, **Redis**, and the **Worker** are separate processes:
1. **Kill the API server (`src/index.js`) mid-test:** Any request that already received `202 Accepted` is safely stored in Redis. The Worker keeps running and still delivers those emails.
2. **Kill the Worker (`src/workers/emailWorker.js`) mid-test:**
   - The API server **still accepts all 20 requests in `<5ms`** and stores the jobs in Redis (`waiting` state).
   - Jobs that were mid-flight (`active` state) when the Worker died are marked **stalled** by BullMQ (after ~30s lock expiry) and automatically **retried** (`attempts: 3` in `emailQueue.js`).
   - As soon as you restart `npm run worker`, it picks up where it left off and drains the backlog.

> **Note:** Even if **both** the API server and Worker crash, as long as **Redis** is running (with persistence enabled), **zero queued jobs are lost**.

---

## 🧠 Key Concepts

### When do you need a Message Queue?

| Situation | Use Queue? |
|-----------|-----------|
| Response needs the result immediately (e.g., login check) | ❌ No |
| Task takes > 100ms and client doesn't need the result to continue | ✅ Yes |
| Task can fail and needs retries | ✅ Yes |
| Task must survive server restarts | ✅ Yes |
| You want to control throughput (rate limiting) | ✅ Yes |
| Fan-out: 1 event → multiple consumers | ✅ Yes |

### Real-world examples that use queues
- Sending emails / SMS / push notifications
- Generating PDF / image reports
- Resizing/transcoding uploaded images or videos
- Charging a credit card (Stripe webhook → queue → process)
- Syncing data to third-party APIs
- Search index updates after a DB write

### BullMQ features used here
| Feature | Where | Why |
|---------|-------|-----|
| `attempts: 3` | emailQueue.js | Auto-retry on failure |
| `backoff: exponential` | emailQueue.js | Don't hammer a flaky service |
| `concurrency: 5` | emailWorker.js | Parallel job processing |
| `getState()` | routes/register.js | Poll job progress |
| `removeOnComplete` | emailQueue.js | Prevent Redis memory bloat |

---

## 📌 Ports at a glance

| Service | Port |
|---------|------|
| Phase 1 API | 3001 |
| Phase 2 API | 3002 |
| Redis | 6379 |
