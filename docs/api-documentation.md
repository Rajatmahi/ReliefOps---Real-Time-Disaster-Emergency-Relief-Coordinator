# API quick reference

All business routes are under `/api`. Interactive OpenAPI documentation is at `/docs` in development.

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | Public; returns bearer JWT |
| POST | `/api/auth/register` | Public; always creates a reporter account, never an admin/coordinator |
| POST | `/api/coordinator-applications` | Authenticated reporter; submits a coordinator role request |
| GET | `/api/coordinator-applications/mine` | Authenticated; views own requests and decisions |
| GET | `/api/coordinator-applications` | Admin; lists all applications |
| PATCH | `/api/coordinator-applications/{id}/review` | Admin; approves/promotes or declines with a reason |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/change-password` | Authenticated; verifies current password |
| GET | `/api/locations/search?query=...` | Authenticated; manual place-name geocoding |
| GET | `/api/users` | Admin; lists organization accounts |
| POST | `/api/users` | Admin; creates an organization account |
| PATCH | `/api/users/{id}` | Admin; changes access role or resets password |
| POST, GET | `/api/incidents` | Citizen create; roles see permitted reports |
| GET | `/api/incidents/{id}` | Owner, admin, assigned coordinator, or coordinator for verified dispatch queue |
| PATCH | `/api/incidents/{id}/status` | Admin; valid transitions only |
| GET | `/api/incidents/{id}/history` | Owner, admin, assigned coordinator, or coordinator for verified dispatch queue |
| POST, GET | `/api/teams` | Admin creates; coordinators read their own teams; admins read all |
| GET, PATCH | `/api/teams/{id}` | Admin or owning coordinator reads; admin updates |
| GET | `/api/assignments/recommended-teams?incident_id={id}` | Admin or coordinator retrieves eligible available teams; coordinator must be in the incident's nearest-K distinct coordinator group |
| POST, GET | `/api/assignments` | Admin or matched coordinator assigns (coordinator can use only own teams); admin/coordinator read permitted assignments |
| PATCH | `/api/assignments/{id}/status` | Assigned coordinator or admin |
| GET | `/api/inventory` | Authenticated |
| POST, PATCH | `/api/inventory[/{id}]` | Admin |
| POST | `/api/inventory/{id}/transactions` | Admin |
| GET | `/health` | Public health and database check |

Send `Authorization: Bearer <access_token>` for protected routes. Incident and assignment lists are capped at 100 rows per request; incidents accept `skip`, `limit`, `status`, `severity`, `disaster_type`, and `q`. After verification, available, capacity-suitable teams with coordinates are ranked by Haversine distance. Each coordinator is represented once by their closest eligible team; the nearest `DISPATCH_TOP_K` distinct coordinators can see the incident. A matched coordinator can assign any of their own available teams with sufficient capacity. The default K is 3. API errors use FastAPI's JSON `detail` response. The current implementation does not include a paginated response envelope.
