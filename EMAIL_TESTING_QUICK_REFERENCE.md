# Email Testing - Quick Reference

## 🚀 One-Line Test All Emails

```bash
# Start dev server
npm run dev

# In another terminal - Send all 18 emails
curl -X POST http://localhost:3000/api/test/test-all-emails -H "Content-Type: application/json" -d '{"action":"send-all"}'

# Check results in inbox or database
psql -U postgres -d lavelle_db -c "SELECT template, recipient, status FROM EmailLog ORDER BY createdAt DESC LIMIT 20;"
```

---

## 📧 Test Commands

| What | Command |
|------|---------|
| **Send all 18 emails** | `curl -X POST http://localhost:3000/api/test/test-all-emails -H "Content-Type: application/json" -d '{"action":"send-all"}'` |
| **Send one template** | `curl -X POST http://localhost:3000/api/test/test-all-emails -H "Content-Type: application/json" -d '{"action":"send-single","templateName":"account-welcome"}'` |
| **Trigger cron jobs** | `curl -X POST http://localhost:3000/api/test/test-all-emails -H "Content-Type: application/json" -d '{"action":"trigger-jobs"}'` |
| **List templates** | `curl -X POST http://localhost:3000/api/test/test-all-emails -H "Content-Type: application/json" -d '{"action":"list"}'` |
| **Send to custom email** | `curl -X POST http://localhost:3000/api/test/test-all-emails -H "Content-Type: application/json" -d '{"action":"send-all","testEmailOverride":"test@example.com"}'` |

---

## 📋 All 18 Templates

```
Authentication (3)
  ✓ account-welcome
  ✓ email-verification-otp
  ✓ password-reset-request

Enrolment (2)
  ✓ enrolment-confirmation
  ✓ payment-received-enrolment

Exams (6)
  ✓ exam-registration-confirmed
  ✓ exam-results
  ✓ exam-scheduled
  ✓ exam-submission-received-admin
  ✓ exam-window-opened-candidate
  ✓ exam-window-opened-staff

Certificates (2)
  ✓ certificate-issued
  ✓ certificate-revoked

Staff (2)
  ✓ staff-invitation
  ✓ admin-password-reset-request

Engagement (3)
  ✓ profile-completion-reminder
  ✓ re-engagement-reminder-3day
  ✓ re-engagement-reminder-7day
```

---

## 🔍 Verify Results

### Inbox
Check: `praise1564@gmail.com`

### Database
```sql
-- See all emails sent
SELECT template, recipient, status, sentAt FROM EmailLog 
ORDER BY createdAt DESC LIMIT 50;

-- Count by template
SELECT template, COUNT(*) as count, MAX(createdAt) as latest 
FROM EmailLog 
GROUP BY template 
ORDER BY latest DESC;

-- See errors only
SELECT template, errorMessage FROM EmailLog 
WHERE status = 'FAILURE' 
ORDER BY createdAt DESC;
```

### Ethereal Email (if using test account)
- Console logs will show preview URL
- Click link to view email in browser

---

## ⚙️ Setup (One-time)

### 1. Update `.env.local` with test SMTP (Optional)

Get Ethereal credentials:
```bash
node -e "const nodemailer = require('nodemailer'); nodemailer.createTestAccount((err, testAccount) => { console.log('SMTP_USER=' + testAccount.user); console.log('SMTP_PASS=' + testAccount.pass); });"
```

Update `.env.local`:
```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user
SMTP_PASS=your-ethereal-pass
SMTP_ENC=tls
NEXTAUTH_URL=http://localhost:3000
```

### 2. Start Dev Server
```bash
npm run dev
```

---

## 🎯 Typical Test Flow

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Run tests
# Test 1: Send all emails
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-all"}'

# Test 2: Check database
psql -U postgres -d lavelle_db \
  -c "SELECT COUNT(*) FROM EmailLog WHERE createdAt > NOW() - INTERVAL '1 minute';"

# Test 3: Trigger jobs
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"trigger-jobs"}'

# Test 4: Check specific template
curl -X POST http://localhost:3000/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-single","templateName":"certificate-issued"}'
```

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| No emails sent | Check SMTP credentials in `.env.local` |
| {{undefined}} in emails | Check template variables match data |
| Links broken | Verify `NEXTAUTH_URL` set correctly |
| Emails not in inbox | Use Ethereal Email to see preview URL |
| Database error | Run `npm run db:migrate` |
| Scheduler not starting | Check server logs for errors |

---

## 📊 Expected Results

When everything works:

✅ All 18 emails send in <5 seconds
✅ Emails appear in inbox (or Ethereal preview URL)
✅ EmailLog table has 18+ new records
✅ No errors in console
✅ All variables filled in correctly
✅ Links use correct domain (localhost:3000)

---

## 🚀 Deploy to Staging

```bash
# Push changes
git add .
git commit -m "test: add comprehensive email testing endpoint"
git push origin develop

# Vercel auto-deploys
# Then test on staging:

curl -X POST https://lavelle-tech-platform-git-develop-tega-odias-projects.vercel.app/api/test/test-all-emails \
  -H "Content-Type: application/json" \
  -d '{"action":"send-all"}'
```

---

## 💡 Pro Tips

1. **Send to yourself first** — Change `testEmail` in `route.ts`
2. **Use Ethereal** — No real emails sent, perfect for dev testing
3. **Check logs** — Database logs are most reliable
4. **Test one at a time** — Easier to debug issues
5. **Inspect email source** — Right-click > View Source to check HTML

---

**Status:** Ready to test! 🧪
