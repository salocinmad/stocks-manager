#!/bin/bash
# Run tests sequentially to avoid DB collision (TRUNCATE race conditions)
set -e

echo "Running tests sequentially..."

echo "1/8: alerts.test.ts"
bun test tests/alerts.test.ts

echo "2/8: auth.test.ts"
bun test tests/auth.test.ts

echo "3/8: market.test.ts"
bun test tests/market.test.ts

echo "4/8: password_reset.test.ts"
bun test tests/password_reset.test.ts

echo "5/8: pnl.service.test.ts"
bun test tests/pnl.service.test.ts

echo "6/8: pnl.test.ts"
bun test tests/pnl.test.ts

echo "7/8: portfolio.logic.test.ts"
bun test tests/portfolio.logic.test.ts

echo "8/8: portfolio.test.ts"
bun test tests/portfolio.test.ts

echo "✅ All tests passed!"
