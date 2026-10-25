# Database backup and recovery

For the local Docker database, `postgres_data` is persistent across container recreation but is not a backup. Create a logical backup before important local work:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > disaster-relief-backup.sql
```

Restore to an empty database only after confirming the target and preserving any data that matters:

```sh
cat disaster-relief-backup.sql | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

For AWS, use RDS automated backups and periodic manual snapshots. Keep RDS private, encrypt snapshots, restrict snapshot access, and test restore to a separate DB instance. Record the recovery point and elapsed restore time. The local and AWS exercises do not imply zero data loss or instant recovery; actual RPO/RTO depend on configured backups and the restore test.
