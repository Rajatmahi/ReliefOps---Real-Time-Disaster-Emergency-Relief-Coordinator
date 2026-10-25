# Architecture

```mermaid
flowchart LR
  Citizen[Citizen browser] --> FE[React + Vite frontend]
  Admin[Administrator browser] --> FE
  Coord[Coordinator browser] --> FE
  FE -->|HTTPS / JSON / JWT| API[FastAPI on EC2 or local Docker]
  FE -->|Static assets| CDN[CloudFront / Amplify]
  CDN --> S3[S3 static frontend origin]
  API --> DB[(PostgreSQL on RDS or local Docker)]
  API --> Logs[CloudWatch Logs and alarms]
```

Local development uses the same three logical services with Docker Compose: frontend, FastAPI backend, and PostgreSQL. Alembic owns schema changes. JWT authentication and server-side role checks protect API actions. The prototype polls on page load and refreshes after user actions; it does not implement WebSockets or automatic background live updates. Simulated data is intended for academic demonstration only.
