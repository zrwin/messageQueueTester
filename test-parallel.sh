#!/usr/bin/env bash

# Usage:
#   ./test-parallel.sh         # defaults to port 3001 (Phase 1)
#   ./test-parallel.sh 3002    # test Phase 2

PORT=${1:-3001}
COUNT=1000
URL="http://localhost:${PORT}/register"

echo "🚀 Sending ${COUNT} parallel POST requests to ${URL}..."
START=$(node -e "console.log(Date.now())")

for i in $(seq 1 $COUNT); do
  (
    TIME=$(curl -s -o /dev/null -w "%{time_total}" \
      -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"Alice-${i}\",\"email\":\"alice${i}@example.com\"}")
    echo "  Request #${i} finished in ${TIME}s"
  ) &
done

wait

END=$(node -e "console.log(Date.now())")
TOTAL=$(node -e "console.log((($END - $START) / 1000).toFixed(2))")
echo "⏱  All ${COUNT} requests completed in ${TOTAL}s"
