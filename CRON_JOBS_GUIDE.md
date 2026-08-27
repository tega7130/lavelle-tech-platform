# Cron Jobs and Email Scheduler Guide

This document describes the scheduled email system for Lavelle Tech Platform, including how the cron jobs work and how to configure them.

## Overview

The email scheduler automatically sends transactional and reminder emails based on specific events and time intervals. All email jobs are server-side only and run using the `node-cron` library.

## Architecture

### Components

1. **`src/lib/cron-jobs.ts`** — Job handler functions
   - `sendProfileCompletionReminders()` — Sends 24h profile completion reminder
   - `sendReEngagementReminder3day()` — Sends 3-day inactivity reminder
   - `sendReEngagementReminder7day()` — Sends 7-day inactivity reminder
   - `sendExamWindowOpenedCandidateNotifications()` — Sends candidate exam window notifications
   - `sendExamWindowOpenedStaffNotifications()` — Sends staff exam window notifications

2. **`src/lib/scheduler.ts`** — Scheduler setup and management
   - `startScheduler()` — Initializes all cron jobs on server startup
   - `stopScheduler()` — Gracefully stops all jobs (for testing/shutdown)
   - `triggerJobImmediate()` — Manually trigger a job for testing

3. **`instrumentation.ts`** — Server startup hook
   - Automatically called by Next.js on server start
   - Initializes the scheduler

## Job Schedules

### 1. Profile Completion Reminder
- **When:** Hourly at the top of each hour
- **Cron:** `0 * * * *`
- **Who:** Candidates who registered ~24h ago without completing their profile
- **Template:** `profile-completion-reminder`

### 2. Re-engagement Reminder (3 days)
- **When:** Daily at 08:00 AM
- **Cron:** `0 8 * * *`
- **Who:** Candidates inactive in lectures for 3+ days
- **Template:** `re-engagement-reminder-3day`

### 3. Re-engagement Reminder (7 days)
- **When:** Daily at 09:00 AM
- **Cron:** `0 9 * * *`
- **Who:** Candidates inactive in lectures for 7+ days
- **Template:** `re-engagement-reminder-7day`

### 4. Exam Window - Candidate Notification
- **When:** Every 30 minutes
- **Cron:** `*/30 * * * *`
- **Who:** Candidates enrolled in the programme when exam window opens
- **Template:** `exam-window-opened-candidate`

### 5. Exam Window - Staff Notification
- **When:** Every 30 minutes
- **Cron:** `*/30 * * * *`
- **Who:** Staff with MANAGE_EXAMS or MARK_SUBMISSIONS permissions
- **Template:** `exam-window-opened-staff`

## How to Deploy

### Prerequisites
- Node.js 18+ (for node-cron support)
- `node-cron` dependency installed (already added to package.json)

### Installation Steps

1. **Install dependencies** (already done via `npm install`)
   ```bash
   npm install
   ```

2. **Build the application**
   ```bash
   npm run build
   ```

3. **Start the server**
   ```bash
   npm start
   ```

The scheduler automatically initializes when the server starts. You'll see console logs like:
```
[instrumentation] Starting email scheduler...
[scheduler] Profile completion reminder scheduled (hourly)
[scheduler] Re-engagement 3-day reminder scheduled (daily at 8 AM)
[scheduler] Re-engagement 7-day reminder scheduled (daily at 9 AM)
[scheduler] Exam window candidate notifications scheduled (every 30 min)
[scheduler] Exam window staff notifications scheduled (every 30 min)
[instrumentation] Email scheduler started successfully
```

## Testing Jobs

### Testing a Specific Job

You can trigger a job manually for testing:

```typescript
// In an API route or server action
import { triggerJobImmediate } from "@/lib/scheduler";

// Trigger profile completion reminders
await triggerJobImmediate("profile-completion-reminder");

// Trigger 3-day re-engagement reminders
await triggerJobImmediate("re-engagement-reminder-3day");

// Trigger 7-day re-engagement reminders
await triggerJobImmediate("re-engagement-reminder-7day");

// Trigger candidate exam notifications (optional: specific window)
await triggerJobImmediate("exam-window-opened-candidate", {
  examWindowId: "window-123",
});

// Trigger staff exam notifications (optional: specific window)
await triggerJobImmediate("exam-window-opened-staff", {
  examWindowId: "window-123",
});
```

### Example Test Endpoint

Create a test API route at `src/app/api/admin/test-email-job/route.ts`:

```typescript
import { triggerJobImmediate } from "@/lib/scheduler";

export async function POST(request: Request) {
  const { jobName } = await request.json();

  try {
    await triggerJobImmediate(jobName);
    return Response.json({ success: true, message: `Triggered ${jobName}` });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

## Job Logic Details

### Profile Completion Reminder

Finds candidates where:
- Created between 23-25 hours ago (1-hour buffer around 24h mark)
- Profile not completed (`profile.completedAt IS NULL`)

Sends email with link to complete profile.

### Re-engagement Reminders

**3-day reminder** queries `LectureProgress` records where:
- `lastSeenAt` ≤ 3 days ago
- Enrolment status is ACTIVE or COMPLETED
- De-duplicates by enrolmentId to send only one per candidate

**7-day reminder** uses same logic but with 7+ days of inactivity.

### Exam Window Notifications

Both candidate and staff notifications:
1. Find exam windows created in the last hour (when running periodically)
2. For candidates: Query all enrolled candidates in that programme
3. For staff: Query all staff with exam-related permissions
4. Send emails with exam details and relevant URLs

## Monitoring and Logs

All cron jobs log their execution:
```
[cron] profile-completion-reminder: sent 5/5
[cron] re-engagement-reminder-3day: sent 12/15
[cron] re-engagement-reminder-7day: sent 3/5
[cron] exam-window-opened-candidate: sent 45 emails across 2 windows
[cron] exam-window-opened-staff: sent 12 emails across 2 windows
```

Check server logs to verify jobs are running correctly.

## Email Configuration

All emails use variables from `EMAIL_CONFIG` (src/lib/email-config.ts):
- `supportEmail` — Contact email in footer
- `supportPhoneNumber` — Support phone number
- `securityContactEmail` — Security-related inquiries
- `examCoordinatorEmail` — Exam submissions

These are loaded from environment variables with sensible defaults.

## Security Notes

1. **Server-only:** All scheduler code uses `"use server"` — no client-side execution
2. **Rate limiting:** Each job includes error handling to prevent crashes
3. **Database safety:** Queries use Prisma ORM with proper typing
4. **Email safety:** All variables are HTML-escaped in templates
5. **Fire-and-forget:** Jobs don't block business operations

## Troubleshooting

### Jobs not running

1. Check server logs for initialization errors
2. Verify `NEXTAUTH_URL` environment variable is set (used for URLs in emails)
3. Ensure SMTP credentials are configured in `.env.local` / `.env.production.local`
4. Check that database migrations have run: `npm run db:migrate`

### Email not sending

1. Check EmailLog table for records and error messages
2. Verify SMTP credentials in Brevo/environment
3. Review job execution logs for send errors
4. Use `triggerJobImmediate()` to debug a specific job

### Too many emails

1. Adjust cron schedules in `src/lib/scheduler.ts`
2. Modify query conditions in `src/lib/cron-jobs.ts` (e.g., change day thresholds)
3. Add deduplication logic or email suppression list

## Future Enhancements

Possible improvements:
- Add email suppression list (opt-out)
- Implement exponential backoff for retries
- Add Slack notifications for job failures
- Create admin dashboard to view job history
- Add email preview/test interface
- Implement rate limiting per recipient
- Add job metrics collection (send counts, error rates)
