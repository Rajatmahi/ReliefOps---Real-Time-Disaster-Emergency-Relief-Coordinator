# Implementation checklist

Repository inspection (Phase 1): the existing workspace contains a React/Vite client and FastAPI/PostgreSQL API with JWT roles, incident reporting, teams, assignments, stock transactions, Leaflet map, Docker Compose, and migrations 0001–0003. There was no `AGENTS.md`. Existing root-level untracked Python/JS files are unrelated and were not modified.

- [x] Inspect repository and record initial state.
- [x] Phase 2: Backend configuration, PostgreSQL models, Alembic migration, health check, and incident APIs.
- [x] Phase 3: Authentication, roles, rescue teams, assignments, and inventory APIs.
- [x] Phase 4: React/Vite frontend connected to the API.
- [x] Phase 5: Validation, development demo seed data, backend tests, PostgreSQL HTTP smoke, frontend build, and package audit (browser UI automation not run).
- [x] Phase 6: Docker Compose local verification (PostgreSQL migration, backend health, frontend HTTP response).
- [x] Phase 7: AWS, monitoring, backup, and recovery documentation.
- [x] Phase 8: Full available verification and final documentation/results.

- [x] Phase 2 extension: structured incident urgency, explainable priority recommendation/override, invalid report reason, duplicate suggestions, audited status reasons, arrival/outcome notes, and separate admin verification before incident resolution.
- [x] Alembic migration 0004 for new operational fields.
- [x] Updated incident intake, detail, and assignment UI for urgency indicators and outcome verification.
- [x] Connected the role workflow: admin verifies; coordinators see verified incidents, can assign only their own teams, and update field progress; admins review outcomes; reporters see their own reports/history.
- [x] Added role-scoped incident and team access, role-specific dashboards/dispatch queue, and admin outcome review queue.
- [x] Expanded workflow tests; latest run: 7 passed. Frontend production build succeeded.
- [x] Added reporter-to-coordinator application, admin approval/decline with recorded decision, approved role promotion, applicant status view, and migration 0005.
- [x] Added coverage for request access, pending duplicate prevention, decline/reapply, approval, role promotion, and immutable review.

Still incomplete against the broader requested platform: shelters, resource requests/reservations, persisted notifications, responder accept/reject, attachments, offline sync, external AWS messaging/storage, richer audit events, and PostgreSQL concurrency/browser end-to-end verification. These are explicitly not claimed as implemented. Review `README.md` operational limits before field use.
