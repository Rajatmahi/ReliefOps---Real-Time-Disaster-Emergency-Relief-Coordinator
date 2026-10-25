# Database schema

| Table | Key relationships and purpose |
|---|---|
| `users` | Unique email; citizen, admin, or coordinator role; hashed password. |
| `incidents` | Reporter FK; indexed status, severity, type and reporter; optional place label, coordinates and people-count checks. |
| `incident_status_history` | Incident FK and actor FK; records each state transition. |
| `rescue_teams` | Unique team name; positive capacity; availability check; optional coordinator FK and mapped base-place label/coordinates. |
| `assignments` | Incident/team/assigning-user FKs; status and timestamps; active conflicts are checked transactionally. |
| `inventory` | Unique center/item pair; nonnegative quantity check. |
| `inventory_transactions` | Inventory and actor FKs; positive transaction quantity, type check, and timestamp. |

Alembic migration `0001_initial` creates the schema and `0002_coordination_indexes` adds indexes for availability, coordinator, active assignment, and status-history lookups; `0003_location_labels` stores the selected place labels for reports and teams. Use `alembic upgrade head`; model metadata creation is used in isolated tests only, not as the production migration strategy. PostgreSQL `SELECT ... FOR UPDATE` protects assignment and inventory updates from conflicting writers. SQLite ignores that row-lock clause, so the full concurrency guarantee must be evaluated on PostgreSQL.
