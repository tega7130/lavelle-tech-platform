-- One-time fix: these two migrations were incorrectly marked "applied"
-- via `prisma migrate resolve --applied` before their tables actually
-- existed. This removes only their bookkeeping rows from Prisma's
-- internal _prisma_migrations table so `prisma migrate deploy` will
-- correctly re-run their real CREATE TABLE SQL.
DELETE FROM "_prisma_migrations"
WHERE migration_name IN ('20260827131200_add_email_log', '20260827_add_video_upload');
