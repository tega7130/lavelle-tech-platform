-- Safely resets the super admin's password, avoiding the manual
-- string-quoting bug that likely broke the original create-super-admin.sql
-- run (a password containing an apostrophe or quote character silently
-- corrupts a hand-pasted SQL string literal). Uses psql's :'var'
-- substitution instead, which quotes the value correctly no matter what
-- characters it contains.
--
-- Usage in psql:
--   \set new_password 'YourActualPasswordHere'
--   \i scripts/reset-super-admin-password.sql
--
-- Or as a one-liner from the shell:
--   psql "$DATABASE_URL" -v new_password='YourActualPasswordHere' -f scripts/reset-super-admin-password.sql

UPDATE "Staff"
SET "passwordHash" = crypt(:'new_password', gen_salt('bf', 12)),
    "updatedAt" = now()
WHERE email = 'lavelleinstitute@gmail.com'
RETURNING id, email, status, role;
