export const EMAIL_CONFIG = {
  // Certificate & Appeals
  appealDeadlineDays: parseInt(process.env.APPEAL_DEADLINE_DAYS || '5', 10),

  // Exam & Marking
  expectedMarkingTurnaroundDays: {
    FOUNDATION: parseInt(process.env.MARKING_TURNAROUND_FOUNDATION || '5', 10),
    SPECIALIST: parseInt(process.env.MARKING_TURNAROUND_SPECIALIST || '7', 10),
    ADVANCED_PRACTITIONER: parseInt(process.env.MARKING_TURNAROUND_ADVANCED || '10', 10),
  },

  // Support Contact
  supportPhoneNumber: process.env.SUPPORT_PHONE || '+234 XXX XXX XXXX',
  supportEmail: process.env.SUPPORT_EMAIL || 'candidates@lavelle.ng',
  securityContactEmail: process.env.SECURITY_EMAIL || 'security@lavelle.ng',
  examCoordinatorEmail: process.env.EXAM_COORDINATOR_EMAIL || 'exams@lavelle.ng',

  // Staff Role Descriptions
  roleDescriptions: {
    REGISTRAR:
      "Manage candidate records, enrolments, and credential issuance. You'll oversee data integrity and ensure all candidates are properly registered and tracked throughout their journey.",
    ACADEMIC_ADMIN:
      "Coordinate programmes, manage curricula, and oversee academic standards across all tiers. You'll work with faculty to ensure quality delivery and track candidate progress.",
    FACULTY:
      "Deliver lectures, create course materials, and assess candidate work. You'll be the expert voice in your specialisation, guiding candidates through their learning journey.",
    FINANCE:
      "Manage payments, invoicing, and financial reporting. You'll process enrolments, track revenue, and ensure accurate financial records for the institute.",
    SUPPORT:
      "Provide candidate support via email, chat, and phone. You'll answer questions, troubleshoot issues, and ensure candidates have a smooth experience.",
    CONTENT_MANAGER:
      "Manage programme content, learning materials, and digital assets. You'll ensure all resources are up-to-date, accessible, and aligned with learning outcomes.",
    READ_ONLY:
      "View reports and candidate data for monitoring and compliance purposes. You'll have access to dashboards and reports but cannot make changes to records.",
    SUPER_ADMIN: 'Full system access and administration',
  },
};
