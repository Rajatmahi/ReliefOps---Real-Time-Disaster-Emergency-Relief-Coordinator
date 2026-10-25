# Verification record

This record separates measured results from work not covered by the verification runs.

## Current local checks

- Backend integration suite: **4 passed** against isolated in-memory SQLite, covering authentication/roles, incident transitions/history, team assignment lifecycle/capacity, and inventory nonnegative stock.
- Alembic offline SQL generation: **passed** for the initial PostgreSQL migration.
- Frontend production build: **passed** with separate map/chart/vendor chunks; no oversized chunk warning.
- Frontend dependency audit: **0 vulnerabilities** after moving to Tailwind CSS 4 with its Vite plugin.
- Docker Compose: **passed**. PostgreSQL, backend, and frontend containers started; backend health check passed and `GET /health` returned HTTP 200 with `database: ok`; frontend returned HTTP 200.
- Alembic: **passed** against PostgreSQL during backend container startup; current revision is `0002_coordination_indexes (head)`.
- PostgreSQL HTTP smoke: **passed** for login, authorization, incident history, assignment start/completion, stock transactions, and overdraw rejection. Temporary users/records were deleted afterward.
- Locust local experiment: **measured** against Compose `GET /health` (which queries PostgreSQL) from the same Apple Silicon laptop. Each run lasted 15 seconds with 0.2–1.0 seconds between requests. These results describe this host and are not a production/AWS capacity guarantee.
- The Compose database had its schema migrated but no demo rows when Locust ran. The measurements cover the lightweight database-backed health route; they do not represent larger incident searches or write load. Full browser form automation was not run; the frontend login page loaded and its production build passed.

## Experiment protocol

1. Start the local stack and seed a development dataset.
2. Run the same 15-second Locust test at 1, 5, and 10 concurrent users; keep the host machine and dataset constant.
3. Record request count, requests/second, median and 95th percentile response time, and failures from Locust's CSV/HTML report.
4. State that measurements describe one local Docker host and are not a production or AWS capacity guarantee.

| Users | Duration | Requests | Throughput (req/s) | Median (ms) | p95 (ms) | Errors |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 15 s | 14 | 1.39 | 9 | 29 | 0 |
| 5 | 15 s | 107 | 7.31 | 8 | 15 | 0 |
| 10 | 15 s | 193 | 13.14 | 8 | 13 | 0 |

These observed values are not targets. Locust percentile estimates are approximate at this sample size. The experiment focused on the public health route, not authenticated incident reads or write contention.
