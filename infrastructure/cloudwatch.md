# CloudWatch monitoring

The API writes one JSON log event per HTTP request with the method, path, status code, and elapsed milliseconds. Database health failures are logged with a stack trace. On EC2, configure the CloudWatch agent or Docker's `awslogs` driver to forward stdout/stderr to a log group such as `/disaster-relief/api`; set a defined retention period and avoid logging passwords, bearer tokens, report descriptions, or other sensitive information.

Create alarms for EC2 status checks/CPU, RDS CPU/storage/connections, load balancer unhealthy targets and 5xx responses, and API 5xx count. `GET /health` checks database connectivity and returns 503 when it cannot connect, which is suitable as a load balancer health check. The prototype does not install or configure AWS agents automatically; see [the deployment guide](aws-deployment.md) for the instance role and setup path.
