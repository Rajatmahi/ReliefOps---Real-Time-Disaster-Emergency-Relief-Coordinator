# AWS deployment guide (optional)

This is a beginner deployment outline for the academic prototype. It provisions no AWS resources. Use the AWS Pricing Calculator before starting and remove resources when finished; EC2, RDS, storage, snapshots, public IPv4, and CloudFront can incur charges.

## 1. Plan the network

1. Pick one AWS Region close to the demo audience and create a dedicated VPC with public and private subnets across at least two Availability Zones.
2. Put the EC2 backend in a public subnet only if it must receive internet traffic directly. For a more controlled design, place it privately behind an Application Load Balancer in public subnets.
3. Put the RDS PostgreSQL instance in a DB subnet group using private subnets. Set **Public access: No**.
4. Create separate security groups. The load balancer accepts HTTPS (443) from the internet. The backend accepts application traffic only from the load balancer security group, or port 8000 only from a known administrative IP for a temporary direct demo. RDS accepts TCP 5432 only from the backend security group. Do not open PostgreSQL to `0.0.0.0/0`.
5. Use Systems Manager Session Manager or a restricted SSH rule for administration; avoid a permanent SSH rule open to the world.

## 2. Create PostgreSQL on RDS

In the RDS console choose **Create database → PostgreSQL**, a small class-project-appropriate instance, private subnets, encryption at rest, automated backups, and a generated master password. Store the credential in AWS Secrets Manager; do not put it in source control, user data, or a frontend variable. Create an application database/user with only the permissions the app needs. Configure the RDS security group to allow 5432 from the backend security group, then test the connection from EC2. Run `alembic upgrade head` from the backend container after setting its secret-backed `DATABASE_URL`.

## 3. Deploy the backend container to EC2

1. Launch a supported Linux EC2 instance in the chosen subnet with an instance profile limited to reading its required Secrets Manager secret and writing logs/metrics to CloudWatch.
2. Install Docker using the distribution's official package instructions. Restrict shell access and keep the operating system patched.
3. Build the backend image in CI or on the instance, publish it to a private Amazon ECR repository, then pull the image on EC2. Do not copy `.env` into the image.
4. Configure `DATABASE_URL`, a randomly generated `JWT_SECRET_KEY`, `CORS_ORIGINS`, and `ENVIRONMENT=production` through Secrets Manager / SSM Parameter Store and the instance's deployment configuration.
5. Start the container with a restart policy, bind it only to the private interface or behind the load balancer, and verify `/health`, `/docs` (disable or protect in production), and a database-backed API call.
6. Deploy updated versioned images and keep a known-good image available for rollback. This single-instance layout is not highly available.

## 4. Host the frontend and enable HTTPS

Build the static frontend with `VITE_API_BASE_URL` set to the public HTTPS API origin. Upload the build output to a private S3 bucket with **Block Public Access** enabled. Put CloudFront in front of the bucket using Origin Access Control, attach a certificate from ACM in the required CloudFront region, and point a Route 53 alias at the distribution. Configure a default root object and SPA route fallback to `index.html`.

For API HTTPS, use an Application Load Balancer with an ACM certificate and a target group for the backend. Configure CORS to the exact frontend origin. A CloudFront distribution can also route `/api/*` to the load balancer origin and other paths to S3, if you prefer a single public domain. AWS Amplify Hosting is an alternative managed frontend host; use its HTTPS domain/custom domain and keep the API URL public and HTTPS-only.

## 5. Secrets, monitoring, and operations

- Keep database and JWT secrets in Secrets Manager or SSM Parameter Store with least-privilege IAM access; rotate them and redeploy consumers after rotation.
- Configure the CloudWatch agent or Docker `awslogs` log driver to send container stdout/stderr to a dedicated log group with retention. The app emits JSON request log records and has `/health` for a load balancer check.
- Create alarms for EC2 CPU, status-check failures, RDS CPU/storage/connections, load-balancer target health, and application 5xx counts. Add an SNS notification only if the project has an appropriate notification destination.
- Keep RDS automated backups enabled with an appropriate retention period. For a manual checkpoint, create a DB snapshot before schema or data changes.

## 6. Backup and recovery drill

1. In RDS, confirm automated backup retention and the maintenance window. Record the recovery point objective (maximum acceptable data loss) and recovery time objective (target restore time) for the class exercise.
2. Create a manual snapshot and note its identifier. Do not delete the source database during the drill.
3. Restore the snapshot to a new private DB instance in the same VPC/subnet group and attach the restricted DB security group.
4. Point a temporary backend configuration at the restored endpoint; run `alembic current`, `/health`, and read-only checks for demo incidents/inventory.
5. Record elapsed restore time, validation results, and cleanup. Delete the temporary restored instance only after confirming it is the drill copy and after preserving the report.

## 7. Cost and cleanup

There is no reliable fixed estimate in this guide because Region, instance size, hours, storage, data transfer, backups, and public IPv4 rates change. Enter the proposed EC2, RDS, EBS, S3, CloudFront, load balancer, logging, and snapshot usage in the AWS Pricing Calculator before creating anything. Use budget alerts. After the demonstration, export needed evidence, then remove the load balancer, EC2 instance, RDS instance and snapshots you no longer need, unused EBS volumes, NAT gateways, Elastic IPs, CloudFront distribution, S3 objects/buckets, and log groups. Check Billing and Cost Management afterward for remaining charges.
