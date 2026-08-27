# Email System Deployment Quick Start

## Pre-Deployment Verification

1. **Dependencies Installed**
   ```bash
   npm install
   # Should show node-cron in node_modules
   ```

2. **TypeScript Compilation**
   ```bash
   npx tsc --noEmit
   # Should have no errors
   ```

3. **Build Passes**
   ```bash
   npm run build
   # Should complete successfully
   ```

## Deployment Steps

### 1. Ensure Environment Variables are Set

**Development (.env.local)**
```env
# SMTP Configuration (Brevo)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-user@example.com
SMTP_PASS=your-brevo-password
SMTP_ENC=tls

# Email Configuration
SENDER_EMAIL=noreply@lavelle.ng
SENDER_NAME="Lavelle Institute"

# Required for email links
NEXTAUTH_URL=http://localhost:3000

# Support Contacts
SUPPORT_EMAIL=support@lavelle.ng
SUPPORT_PHONE=+234 XXX XXX XXXX
SECURITY_EMAIL=security@lavelle.ng
EXAM_COORDINATOR_EMAIL=exams@lavelle.ng

# Timing Configuration
APPEAL_DEADLINE_DAYS=30
MARKING_TURNAROUND_FOUNDATION=7
MARKING_TURNAROUND_SPECIALIST=10
MARKING_TURNAROUND_ADVANCED=14
```

**Production (.env.production.local)**
```env
# Same as above but with production SMTP credentials
NEXTAUTH_URL=https://your-domain.com
```

### 2. Database Migration

```bash
npm run db:migrate
# Ensures EmailLog table exists
# Automatically runs on deploy if using Prisma Migrate
```

### 3. Start Application

**Development**
```bash
npm run dev
# Scheduler starts automatically
# Check console for initialization logs
```

**Production**
```bash
npm start
# Scheduler starts automatically
```

## Verification

### 1. Check Server Logs (on startup)

Look for these lines in server output:
```
[instrumentation] Starting email scheduler...
[scheduler] Profile completion reminder scheduled (hourly)
[scheduler] Re-engagement 3-day reminder scheduled (daily at 8 AM)
[scheduler] Re-engagement 7-day reminder scheduled (daily at 9 AM)
[scheduler] Exam window candidate notifications scheduled (every 30 min)
[scheduler] Exam window staff notifications scheduled (every 30 min)
[instrumentation] Email scheduler started successfully
```

### 2. Test a Job Manually

Create `src/app/api/test/cron-job/route.ts`:

```typescript
import { triggerJobImmediate } from "@/lib/scheduler";

export async function POST(request: Request) {
  const { jobName } = await request.json();

  try {
    await triggerJobImmediate(jobName);
    return Response.json({ success: true, jobTriggered: jobName });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

Test with:
```bash
curl -X POST http://localhost:3000/api/test/cron-job \
  -H "Content-Type: application/json" \
  -d '{"jobName": "profile-completion-reminder"}'
```

### 3. Check Email Log

Query the database:
```sql
SELECT template, recipient, status, errorMessage, sentAt 
FROM EmailLog 
ORDER BY createdAt DESC 
LIMIT 10;
```

## Jobs Running Summary

| Job | Schedule | Timezone | Next Run |
|-----|----------|----------|----------|
| Profile Completion | Hourly at :00 | Server TZ | Every hour |
| Re-engagement 3day | 08:00 daily | Server TZ | Tomorrow 8 AM |
| Re-engagement 7day | 09:00 daily | Server TZ | Tomorrow 9 AM |
| Exam Window Candidate | Every 30 min | Server TZ | Runs continuously |
| Exam Window Staff | Every 30 min | Server TZ | Runs continuously |

*Note: Times are in the server's timezone. For UTC deployments, times are in UTC.*

## Monitoring Dashboard (Optional)

To create an admin endpoint that shows job status:

```typescript
// src/app/api/admin/cron-status/route.ts
import { triggerJobImmediate } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get recent email logs
    const recentEmails = await prisma.emailLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      groupBy: ["template", "status"],
      _count: true,
      orderBy: { template: "asc" },
    });

    // Count by template
    const stats = await prisma.emailLog.groupBy({
      by: ["template"],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      _count: { id: true },
      _avg: { createdAt: true },
    });

    return Response.json({
      status: "running",
      lastUpdate: new Date(),
      stats,
    });
  } catch (error) {
    return Response.json(
      { status: "error", error: String(error) },
      { status: 500 }
    );
  }
}
```

## Rollback Procedure

If you need to disable the scheduler:

1. **Temporarily stop jobs** (in production):
   ```typescript
   // Add to API route
   import { stopScheduler } from "@/lib/scheduler";
   await stopScheduler();
   ```

2. **Permanently disable** (for next deployment):
   - Comment out scheduler initialization in `instrumentation.ts`
   - Redeploy

3. **Re-enable**:
   - Uncomment scheduler initialization
   - Restart server

## Performance Notes

- Jobs run asynchronously without blocking requests
- Each job typically processes 5-50 emails per run
- Database queries are indexed for performance
- No queueing layer needed for these volumes
- Can scale to thousands of emails per day

## Common Issues

| Issue | Solution |
|-------|----------|
| No emails sent | Check SMTP credentials, verify NEXTAUTH_URL set |
| Jobs not running | Check server logs for init errors, verify database |
| Too many emails | Adjust cron schedules in scheduler.ts |
| Duplicate emails | Check EmailLog for duplicates, review cron timing |
| Memory usage high | Normal for node-cron (lightweight), monitor trends |

## Support

For issues or questions:
1. Check console logs for job execution
2. Query EmailLog table for send status
3. Use `triggerJobImmediate()` for debugging
4. Review CRON_JOBS_GUIDE.md for detailed info

---

**Status:** All systems ready for deployment ✅
