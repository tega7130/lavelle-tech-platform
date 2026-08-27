# Email Configuration — Values to Provide

This file documents all the values you need to provide for the email system. Fill these in and add to `src/lib/email-config.ts` once implementation is complete.

## Certificate & Appeals

- [ ] **appealDeadlineDays**: How many days can someone appeal a revoked certificate? (e.g., 14)

## Exam & Marking

- [ ] **expectedMarkingTurnaroundDays**: How many business days until exam results are returned? (e.g., 5)

## Support Contact

- [ ] **supportPhoneNumber**: Support phone number for candidates (e.g., +234 XXX XXX XXXX)
- [ ] **supportEmail**: Support email for candidates (e.g., candidates@lavelle.ng)

## Staff Role Descriptions

When staff are invited, the email says what their role involves. Provide a 1–2 sentence description for each:

- [ ] **REGISTRAR**: Description of registrar responsibilities
- [ ] **ACADEMIC_ADMIN**: Description of academic admin responsibilities
- [ ] **FACULTY**: Description of faculty responsibilities
- [ ] **FINANCE**: Description of finance responsibilities
- [ ] **SUPPORT**: Description of support staff responsibilities
- [ ] **CONTENT_MANAGER**: Description of content manager responsibilities
- [ ] **READ_ONLY**: Description of read-only access

---

**Once you have these values, add them to:**
```
src/lib/email-config.ts
```
