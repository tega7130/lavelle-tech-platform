# Admin Portal Password Reset

Self-service password reset for staff (admin console) accounts. Distinct from, and does not touch, the staff sign-in-by-OTP flow, the candidate password reset flow, or the staff invitation/activation flow (though it reuses the same underlying token table as invitations — see [Database](#database)).

## User flow

```
Forgot password
  ↓ (/staff/forgot-password)
Enter email
  ↓ (POST — always the same generic response)
Reset email sent
  ↓ (admin opens the emailed link)
Click secure link
  ↓ (/staff/reset-password?token=...)
Enter new password + confirm
  ↓ (POST)
Password updated — NOT signed in
  ↓
Go to login
  ↓ (/staff/sign-in)
Normal admin login (password or OTP)
```

If the link is invalid, expired, or already used, `/staff/reset-password` shows a dedicated "no longer valid" state with a button back to `/staff/forgot-password` — never a raw error.

## Routes

Both new, following the existing `/staff/*` convention (`sign-in`, `set-password`):

| Route | Purpose |
|---|---|
| `GET /staff/forgot-password` | Request page — enter email, submit |
| `GET /staff/reset-password?token=...` | The emailed link lands here — enter new password |

`/staff/set-password?token=...` (pre-existing) is unchanged and still serves **invitation activation only** — the two flows now use different routes so they can carry different pages of copy and different post-submit behaviour (see [Password hashing / session behaviour](#password-hashing--session-behaviour)).

## Database

No new tables. Reuses `StaffInvitationToken` (`prisma/schema.prisma`), the table that already backed staff invitations:

```prisma
model StaffInvitationToken {
  id               String    @id @default(uuid())
  staffId          String
  staff            Staff     @relation(fields: [staffId], references: [id])
  invitedByStaffId String?
  invitedByStaff   Staff?    @relation("StaffInvitedBy", fields: [invitedByStaffId], references: [id])
  tokenHash        String    @unique   // sha256 of the plaintext — plaintext is never persisted
  expiresAt        DateTime
  consumedAt       DateTime?
  createdAt        DateTime  @default(now())
}
```

- **Reset token model**: same table as invitations. `invitedByStaffId` is `null` for a reset (there is no inviter — the account requests its own reset), non-null for a genuine invitation.
- **Expiration**: `expiresAt`, checked server-side on every read/consume. A reset token gets **30 minutes** (`PASSWORD_RESET_TOKEN_TTL_MS` in `src/lib/staff-invitation.ts`) — a new, shorter TTL than the pre-existing 48-hour invitation window, since a reset grants entry to an *existing* account and should not stay live as long as a first-time invitation.
- **Usage**: `consumedAt`. `null` = live; any non-null timestamp = spent, and it is never valid again.
- **Relationship**: `staffId` → `Staff`. `previewInvitationToken(token)` and `consumeInvitationToken(tx, token)` (both in `src/lib/staff-invitation.ts`) are the sole read/write paths and are shared by both invitation activation and password reset — no duplicate model or duplicate lookup logic.
- **Cleanup behaviour**: no cron/TTL sweep of old rows (matches the existing invitation-token behaviour — rows are cheap and harmless once `consumedAt` or `expiresAt` has passed). Requesting a *new* reset link invalidates every other outstanding, unconsumed token for that staff member first (`invalidateOutstandingStaffTokens`) — at most one live reset (or invitation) link per account at any time.

## Token lifecycle

1. **Issue** — `requestStaffPasswordResetCore` (`src/lib/staff-auth-actions.ts`) invalidates any outstanding token for the account, then calls `createInvitationTokenRecord(prisma, staffId, undefined, PASSWORD_RESET_TOKEN_TTL_MS)`. The plaintext token is `crypto.randomBytes(32).toString("base64url")` (256 bits of entropy) — cryptographically random, long, unguessable. Only `sha256(token)` is stored.
2. **Preview (non-consuming)** — the reset-password page's Server Component calls `previewInvitationToken(token)` to decide form-vs-invalid without burning the single use (a page refresh must be able to re-render the form).
3. **Consume** — `setStaffPasswordCore` re-validates and consumes the token **inside the same database transaction** that sets the password, so a partial failure can never leave a token spent without a password change (or vice versa).
4. **Invalidate on success or on a fresh request** — consuming sets `consumedAt`; requesting a new reset link invalidates any other live token for that account.

## Password hashing

Unchanged existing mechanism — `hashPassword` / `verifyPassword` (`src/lib/password.ts`, bcrypt). The reset flow calls the exact same `hashPassword` the invitation-activation and sign-in flows already use. Password policy is the existing staff policy (`STAFF_PASSWORD_RULES` in `src/lib/validation/staff.ts`): ≥10 characters, one capital, one number, one symbol — enforced both client-side (live checklist + strength meter) and server-side (`staffSetPasswordSchema`, a Zod refinement).

## Session behaviour — deliberately does *not* auto-sign-in

This is the one behavioural difference from the existing invitation-activation path, both of which share `setStaffPasswordCore`:

- **Invitation activation** (account was `INVITED`): a session is created and the admin lands signed-in — unchanged, existing behaviour.
- **Password reset** (account was already `ACTIVE` — the only way a reset token can exist per `requestStaffPasswordResetCore`'s own guard): `setStaffPasswordCore` returns `sessionToken: null`. The `setStaffPassword` Server Action only sets the session cookie when a token comes back, so a reset **never** auto-authenticates. The success page shows "Go to login" and the admin authenticates normally through `/staff/sign-in`.
- **Existing sessions are revoked on reset**: before consuming the token, `setStaffPasswordCore` calls `revokeAllStaffSessions(staffId, tx)` for the reset branch — every session live on the account before the reset is killed. (Not done for first-time activation, which has no prior sessions.)

## Email trigger and variables

Uses the app's existing transactional email plumbing unchanged — `sendTransactionalEmailByTemplate("admin-password-reset-request", …)` (`src/lib/send-transactional-email.ts`), which resolves the template from `src/lib/email-templates/index.ts` and sends via the existing SMTP transport (`src/lib/email-service.ts`, nodemailer + `EmailLog` audit row). The template file (`src/lib/email-templates/admin-password-reset-request.ts`) **already existed** and was not modified — only the caller (`requestStaffPasswordResetCore`) was touched, to fix the URL it points at and to make `expiryMinutes` match the real TTL.

Variables the template consumes (`AdminPasswordResetRequestVariables`):

| Variable | Source |
|---|---|
| `firstName` | `getFirstName(staff.name)` |
| `role` | `staff.role` |
| `resetPasswordUrl` | `${NEXTAUTH_URL}/staff/reset-password?token=${token}` |
| `expiryMinutes` | `PASSWORD_RESET_TOKEN_TTL_MS / 60_000` (30) |
| `supportEmail` | hard-coded `support@lavelle.ng` |
| `currentYear` | `new Date().getFullYear()` |

The send is fire-and-forget (matches the existing pattern for invitation/reset emails elsewhere in the app) — a provider failure is logged and does not fail the request, so the response to the browser never reveals whether the send succeeded (see [Security](#security-considerations)).

## Security considerations

- **Tokens**: `crypto.randomBytes(32)` (256-bit), base64url-encoded; only the sha256 hash is stored (`tokenHash`), never the plaintext.
- **Expiry**: 30 minutes, enforced server-side on both preview and consume.
- **Single-use**: consuming sets `consumedAt` inside the same transaction as the password change; a second use of the same token is rejected.
- **No reuse across accounts**: the token's `staffId` is fixed at issue time and is never taken from the request — a manipulated URL cannot redirect a reset onto a different account.
- **Existing-account status re-checked at consume time**: if the account was suspended/deactivated between issuing and using the token, the reset is refused (same guard the invitation path already had).
- **Account existence is never disclosed**: `requestStaffPasswordResetCore` returns the exact same `void`/no-op response whether the email matches an `ACTIVE` staff account, an `INVITED`/`SUSPENDED`/`DEACTIVATED` one, or no account at all. The UI always shows "If `<email>` belongs to a Lavelle staff account, a password reset link is on its way" — never a different message for a real vs. fake address.
- **Rate limiting**: reuses the existing Postgres-backed limiter (`enforceRateLimit`, `src/lib/rate-limit.ts`) — unchanged, pre-existing infrastructure, not new. `requestStaffPasswordResetCore` is capped at 3 requests per email+IP per hour; on a lockout it silently no-ops (indistinguishable from "not a real account").
- **Passwords**: hashed with the existing bcrypt-based `hashPassword`; never logged, never stored in plaintext, never included in the audit event description (`recordAuditEvent` logs only the *action* — "Reset the account password" — never the value).
- **Server-side validation everywhere**: email format, token validity/expiry/consumption, password policy, and password-match are all re-validated server-side (`staffSetPasswordSchema`), independent of the client-side checks that exist purely for UX.
- **Session hygiene**: every session live on the account before a reset is revoked (see above) — a stolen or forgotten password cannot leave an old session usable after the legitimate owner locks the account down with a new one.

## Error states

| Condition | Behaviour |
|---|---|
| Malformed/empty email on the request form | Client-side regex blocks submit (`Send reset link` stays disabled) |
| Unknown email | Same generic "sent" response as a real address — no disclosure |
| Missing/invalid/expired/already-used token | `/staff/reset-password` renders "This reset link is no longer valid" + "Request a new link" → `/staff/forgot-password` |
| Password fails policy | Inline field error + live checklist (`STAFF_PASSWORD_RULES`) |
| Passwords don't match | Inline "Passwords do not match" on the confirm field, both client- and server-side |
| Database/transaction failure | Caught by the existing Server Action error boundary; no stack trace or internal detail reaches the browser |
| Email delivery failure | Logged server-side (`console.error`); the request itself still returns success to avoid disclosing the failure or the account's existence |

## Files created

- `src/app/staff/forgot-password/page.tsx`
- `src/app/staff/reset-password/page.tsx`
- `src/components/auth/forgot-password-form.tsx`
- `src/components/auth/reset-password-form.tsx`
- `docs/ADMIN_PASSWORD_RESET.md` (this file)

## Files modified

- `src/lib/staff-invitation.ts` — added `PASSWORD_RESET_TOKEN_TTL_MS` (30 min) and an optional `ttlMs` parameter to `createInvitationTokenRecord` (defaults to the existing 48-hour invitation window, so the two invitation call sites are unaffected).
- `src/lib/staff-auth-actions.ts` — `requestStaffPasswordResetCore` now issues a 30-minute-TTL token, points the email at `/staff/reset-password`, and no longer calls the invitation-flow's dev-log helper (which pointed at the wrong URL for this flow — the real email send already carries the correct link). `setStaffPasswordCore` now returns `sessionToken: string | null` (`null` for a reset) and calls `revokeAllStaffSessions` before a reset.
- `src/app/actions/staff-auth.ts` — `setStaffPassword` only sets the session cookie when `result.sessionToken` is non-null.
- `src/app/staff/sign-in/page.tsx` — "Forgot password?" is now a `Link` to `/staff/forgot-password`; the previous embedded reset-request view/state was removed (superseded by the dedicated page). OTP sign-in on this page is untouched.
- `tests/staff-access.test.ts` — added coverage (see [Testing](#how-to-test-the-flow)); one existing assertion updated for the new `sessionToken: string | null` type.

## How to test the flow

Automated (`npx vitest run tests/staff-access.test.ts`) covers:

- `requestStaffPasswordResetCore` issues a token only for an `ACTIVE` account; silently no-ops for `INVITED`/`SUSPENDED`/`DEACTIVATED`/unknown addresses.
- The issued token's TTL is ~30 minutes, not the 48-hour invitation window.
- A second request invalidates the first token (one live link per account).
- A password-reset token sets the password but returns `sessionToken: null` (no auto-login) and revokes every session already live on the account.
- (Pre-existing, still passing) invitation-activation still returns a real session token and signs the admin in.
- (Pre-existing, still passing) an expired/reused/suspended-account token changes nothing.

Manual (performed live against the local dev server during implementation):

1. `/staff/sign-in` → "Forgot password?" → lands on `/staff/forgot-password`.
2. Submit a real staff email → generic "Check your email… expires in 30 minutes" response; confirmed in `EmailLog` that the email was actually sent, and the `StaffInvitationToken` row's `expiresAt` is ~30 minutes out.
3. Open the emailed link (`/staff/reset-password?token=...`) → form renders with the account's email and a minute-accurate expiry label, password strength meter, and live rule checklist.
4. Submit a valid new password → "Password updated successfully" / "Go to login" — confirmed **no** session cookie was set and `/admin/overview` redirected back to sign-in.
5. Sign in at `/staff/sign-in` with the new password → succeeds, lands on Overview; audit log shows both "Requested a password reset link" and "Reset the account password" events.
6. Reused (already-consumed) token and a garbage/malformed token both → "This reset link is no longer valid" + "Request a new link" → `/staff/forgot-password`.

## Anything that still needs input

None — the email template (`admin-password-reset-request.ts`) already existed with finished copy and was not touched, so there is nothing pending on the email-body side. If a different final copy is wanted, it can be edited in that file directly; the variables it receives are fixed by the table above.
