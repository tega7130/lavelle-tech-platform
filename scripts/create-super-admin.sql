-- Creates an ACTIVE Super Admin staff account with every current
-- Permission granted (enum_range(NULL::"Permission") always reflects
-- whatever permissions exist today, so this stays correct as new ones
-- are added). Self-grants its own permissions (bootstrap case — there
-- is no other staff member yet to be the "granted by").
WITH new_staff AS (
  INSERT INTO "Staff" (id, name, email, "passwordHash", role, status, "activatedAt", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'Lavelle Institute',
    'lavelleinstitute@gmail.com',
    crypt('REPLACE_THIS_PASSWORD', gen_salt('bf', 12)),
    'SUPER_ADMIN',
    'ACTIVE',
    now(),
    now(),
    now()
  )
  RETURNING id
)
INSERT INTO "StaffPermission" ("staffId", permission, "grantedByStaffId", "grantedAt")
SELECT id, unnest(enum_range(NULL::"Permission")), id, now()
FROM new_staff;
