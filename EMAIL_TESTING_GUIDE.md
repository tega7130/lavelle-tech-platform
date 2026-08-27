# Email Testing Guide - All 18 Templates

Comprehensive guide to test all 18 email templates locally and on staging.

## 🚀 Quick Start

### Start Local Dev Server
```bash
npm run dev
```

Watch for scheduler initialization:
```
[instrumentation] Starting email scheduler...
[scheduler] Profile completion reminder scheduled (hourly)
...
[instrumentation] Email scheduler started successfully
```

---

## 📧 Testing Methods

### **Method 1: Send All Emails at Once** (Fastest)

```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-all"}'
```

**Response:**
```json
{
  "action": "send-all",
  "totalTemplates": 18,
  "results": [
    {"template": "account-welcome", "sent": true},
    {"template": "email-verification-otp", "sent": true},
    ...
  ],
  "testEmail": "praise1564@gmail.com"
}
```

All 18 emails sent in seconds! ⚡

### **Method 2: Send Single Template**

Test one template at a time:

```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-single","templateName":"account-welcome"}'
```

Available templates:
- `account-welcome`
- `email-verification-otp`
- `password-reset-request`
- `enrolment-confirmation`
- `payment-received-enrolment`
- `exam-registration-confirmed`
- `exam-results`
- `certificate-issued`
- `certificate-revoked`
- `profile-completion-reminder`
- `exam-scheduled`
- `staff-invitation`
- `admin-password-reset-request`
- `exam-window-opened-candidate`
- `exam-window-opened-staff`
- `exam-submission-received-admin`
- `re-engagement-reminder-3day`
- `re-engagement-reminder-7day`

### **Method 3: Trigger All Cron Jobs**

Test scheduled jobs immediately:

```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"trigger-jobs"}'
```

Triggers all 5 scheduled jobs:
- profile-completion-reminder
- re-engagement-reminder-3day
- re-engagement-reminder-7day
- exam-window-opened-candidate
- exam-window-opened-staff

### **Method 4: List All Templates**

```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"list"}'
```

---

## 🧪 Complete Testing Workflow

### **Step 1: Setup**
```bash
npm run dev
```

### **Step 2: Send All Templates**
```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-all"}'
```

### **Step 3: Check Results**

**Option A: Ethereal Email (Recommended for Testing)**

If using Ethereal Email, the console will show:
```
Preview URL: https://ethereal.email/message/xxxxx
```

Click the link to see each email rendered in browser.

**Option B: Real Email (Brevo)**

Check your inbox at `praise1564@gmail.com`

Emails should arrive within 1-2 seconds.

**Option C: Database Logs**

```bash
# Using psql
psql "postgresql://user:pass@localhost:5432/lavelle_db"

SELECT template, recipient, subject, status, sentAt 
FROM EmailLog 
ORDER BY createdAt DESC 
LIMIT 20;
```

### **Step 4: Verify Email Content**

Check each email for:
- ✅ Correct template name
- ✅ All variables filled in (no {{undefined}})
- ✅ Proper HTML rendering
- ✅ Correct footer with support email
- ✅ Current year in copyright

---

## 📋 Email Testing Checklist

### **Category: Authentication (3 emails)**
- [ ] `account-welcome` — Welcome email with exploration link
- [ ] `email-verification-otp` — OTP for email verification
- [ ] `password-reset-request` — Candidate password reset

### **Category: Enrolment (2 emails)**
- [ ] `enrolment-confirmation` — Enrolment details and dates
- [ ] `payment-received-enrolment` — Payment confirmation

### **Category: Exams (5 emails)**
- [ ] `exam-registration-confirmed` — Exam registration details
- [ ] `exam-results` — Grade and results notification
- [ ] `exam-scheduled` — Exam window dates notification
- [ ] `exam-submission-received-admin` — Admin notification of submissions
- [ ] `exam-window-opened-candidate` — Bulk notification when window opens
- [ ] `exam-window-opened-staff` — Staff notification when window opens

### **Category: Certificates (2 emails)**
- [ ] `certificate-issued` — Certificate awarded
- [ ] `certificate-revoked` — Certificate suspended with appeal option

### **Category: Staff (2 emails)**
- [ ] `staff-invitation` — Onboarding with set-password link
- [ ] `admin-password-reset-request` — Staff password reset

### **Category: Engagement (2 emails)**
- [ ] `profile-completion-reminder` — 24h profile nudge
- [ ] `re-engagement-reminder-3day` — 3-day inactivity reminder
- [ ] `re-engagement-reminder-7day` — 7-day urgent reminder

---

## 🧑‍💻 Test with Custom Email

Send all emails to a different address:

```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-all","testEmailOverride":"your-email@example.com"}'
```

---

## 🔄 Test Cron Jobs Specifically

### **Profile Completion Reminder**
```bash
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"trigger-jobs"}'
```

Then check database:
```sql
SELECT * FROM EmailLog 
WHERE template = 'profile-completion-reminder' 
ORDER BY createdAt DESC LIMIT 5;
```

### **Re-engagement Reminders**

The job needs real data (candidates with lecture progress). Test with:

1. Create test candidate
2. Create test enrolment
3. Create lecture progress > 3 days old
4. Trigger job
5. Verify email in EmailLog

---

## 📊 Verification Points for Each Email

### **account-welcome**
- [ ] Links point to exploration page
- [ ] First name personalized
- [ ] Support email in footer

### **email-verification-otp**
- [ ] OTP code displayed
- [ ] 48-hour expiry shown
- [ ] Verification instructions clear

### **password-reset-request**
- [ ] Reset link valid
- [ ] 30-minute expiry shown
- [ ] "Do not share link" warning

### **enrolment-confirmation**
- [ ] Programme name correct
- [ ] Start date shown
- [ ] Duration displayed
- [ ] Portal link functional

### **payment-received-enrolment**
- [ ] Amount shown
- [ ] Transaction ID included
- [ ] Receipt details present

### **exam-registration-confirmed**
- [ ] Exam date/time correct
- [ ] Duration shown
- [ ] Admission slip link provided

### **exam-results**
- [ ] Grade/score displayed
- [ ] Pass/fail status shown
- [ ] Results link functional
- [ ] Marking turnaround mentioned

### **certificate-issued**
- [ ] Certificate ID shown
- [ ] Download link works
- [ ] Verification URL provided

### **certificate-revoked**
- [ ] Reason for revocation shown
- [ ] Appeal deadline clear
- [ ] Appeal process explained

### **profile-completion-reminder**
- [ ] Profile completion link works
- [ ] 24-hour context clear
- [ ] Action items obvious

### **exam-scheduled**
- [ ] Exam date/time correct
- [ ] Registration deadline shown
- [ ] Rules link provided

### **staff-invitation**
- [ ] Set-password link valid
- [ ] 24-hour expiry shown
- [ ] Role clearly stated

### **admin-password-reset-request**
- [ ] Reset link functional
- [ ] 30-minute expiry mentioned
- [ ] Role displayed

### **exam-window-opened-candidate**
- [ ] Window dates correct
- [ ] Capacity info (if applicable)
- [ ] Registration deadline shown
- [ ] Exam rules link provided

### **exam-window-opened-staff**
- [ ] Staff role recognized
- [ ] Programme details shown
- [ ] Admin portal link provided
- [ ] Responsibilities outlined

### **exam-submission-received-admin**
- [ ] Submission count accurate
- [ ] Total candidates shown
- [ ] Window close date clear
- [ ] Admin link functional

### **re-engagement-reminder-3day / 7day**
- [ ] Programme name shown
- [ ] Inactivity days correct
- [ ] Portal link functional
- [ ] Re-engagement message clear

---

## 🐛 Troubleshooting

### **No emails appear in inbox**
1. Check `.env.local` SMTP credentials
2. Verify `NEXTAUTH_URL` is set
3. Check server console for errors
4. Query EmailLog table: `SELECT * FROM EmailLog ORDER BY createdAt DESC LIMIT 5;`

### **Emails have {{undefined}} variables**
1. Check template data in `test-all-emails/route.ts`
2. Verify variable names match template files
3. Check template variables in `src/lib/email-templates/`

### **Links don't work locally**
1. Verify `NEXTAUTH_URL=http://localhost:3000` in `.env.local`
2. Don't click localhost links on staging (use staging domain instead)

### **Database errors**
1. Ensure migrations ran: `npm run db:migrate`
2. Check EmailLog table exists
3. Verify database connection in `.env.local`

---

## ✅ Full Test Report Template

When testing, document:

```markdown
## Email Testing Report - [DATE]

### Environment
- [ ] Local / Staging
- [ ] Database: PostgreSQL
- [ ] SMTP: Brevo / Ethereal
- [ ] Scheduler: Running

### Test Run
- [ ] All 18 templates sent
- [ ] All emails received
- [ ] Email content verified
- [ ] Database logging working
- [ ] Links functional

### Issues Found
- Issue 1: [Description]
- Issue 2: [Description]

### Status: ✅ PASS / ⚠️ ISSUES / ❌ FAIL
```

---

## 🎯 Summary

**Fastest way to test everything:**

```bash
# 1. Start server
npm run dev

# 2. Send all 18 templates instantly
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-all"}'

# 3. Check results (see preview URL or inbox)

# 4. Query database
psql "postgresql://..." \
  -c "SELECT template, status FROM EmailLog ORDER BY createdAt DESC LIMIT 20;"
```

**Done!** All 18 emails tested in under 1 minute. ⚡
