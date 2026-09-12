import "server-only";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

/**
 * Cron job handlers for scheduled email tasks.
 * These are meant to be called by a scheduler (e.g., node-cron, node-schedule, or a serverless cron service).
 * Each handler queries for candidates/staff that meet the criteria and sends appropriate emails.
 */

/**
 * Profile Completion Reminder (24h after registration)
 * Sends to candidates who registered 24 hours ago but haven't completed their profile yet.
 * Runs every hour to catch candidates at the 24h mark.
 */
export async function sendProfileCompletionReminders() {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find candidates who registered ~24h ago and haven't completed profile
    const candidates = await prisma.candidate.findMany({
      where: {
        createdAt: {
          lte: now,
          gte: new Date(twentyFourHoursAgo.getTime() - 60 * 60 * 1000), // 1-hour buffer
        },
        profile: {
          completedAt: null,
        },
      },
      include: { profile: true },
    });

    let sent = 0;
    for (const candidate of candidates) {
      try {
        await sendTransactionalEmailByTemplate("profile-completion-reminder", candidate.email, {
          firstName: getFirstName(candidate.firstName),
          profileCompletionUrl: `${process.env.NEXTAUTH_URL}/portal/profile`,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear: new Date().getFullYear(),
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send profile-completion-reminder to ${candidate.email}:`, error);
      }
    }

    console.log(`[cron] profile-completion-reminder: sent ${sent}/${candidates.length}`);
  } catch (error) {
    console.error("[cron] profile-completion-reminder job failed:", error);
  }
}

/**
 * Re-engagement Reminder (3 days of inactivity)
 * Sends to candidates who haven't engaged with lectures in 3+ days.
 * Runs daily to catch candidates who hit the 3-day mark.
 * Only sends for published programmes to prevent emails about unavailable courses.
 * Newly-enrolled candidates (within 3 days) are not considered inactive.
 */
export async function sendReEngagementReminder3day() {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Find enrolments with lecture progress older than 3 days
    // Also ensure the candidate has been enrolled for at least 3 days (not newly enrolled)
    const inactiveProgress = await prisma.lectureProgress.findMany({
      where: {
        lastSeenAt: {
          lte: threeDaysAgo,
        },
        enrolment: {
          status: { in: ["ACTIVE", "COMPLETED"] },
          programme: {
            status: "ACTIVE", // Only active programmes
          },
          enrolledAt: {
            lte: threeDaysAgo, // Candidate must be enrolled for at least 3 days
          },
        },
      },
      include: {
        enrolment: {
          include: {
            candidate: true,
            programme: true,
          },
        },
      },
      distinct: ["enrolmentId"],
    });

    const processedEnrolments = new Set<string>();
    let sent = 0;

    for (const progress of inactiveProgress) {
      const enrolmentId = progress.enrolmentId;
      if (processedEnrolments.has(enrolmentId)) continue;
      processedEnrolments.add(enrolmentId);

      const { enrolment } = progress;
      try {
        await sendTransactionalEmailByTemplate("re-engagement-reminder-3day", enrolment.candidate.email, {
          firstName: getFirstName(enrolment.candidate.firstName),
          programmeName: enrolment.programme.title,
          lastActivityDays: 3,
          portalUrl: `${process.env.NEXTAUTH_URL}/portal/programmes/${enrolment.programmeId}`,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear: new Date().getFullYear(),
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send re-engagement-3day to ${enrolment.candidate.email}:`, error);
      }
    }

    console.log(`[cron] re-engagement-reminder-3day: sent ${sent}/${processedEnrolments.size}`);
  } catch (error) {
    console.error("[cron] re-engagement-reminder-3day job failed:", error);
  }
}

/**
 * Re-engagement Reminder (7 days of inactivity)
 * Sends to candidates who haven't engaged with lectures in 7+ days (and didn't respond to 3-day reminder).
 * Runs daily to catch candidates who hit the 7-day mark.
 * Only sends for published programmes to prevent emails about unavailable courses.
 * Newly-enrolled candidates (within 7 days) are not considered inactive.
 */
export async function sendReEngagementReminder7day() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find enrolments with lecture progress older than 7 days
    // Also ensure the candidate has been enrolled for at least 7 days (not newly enrolled)
    const inactiveProgress = await prisma.lectureProgress.findMany({
      where: {
        lastSeenAt: {
          lte: sevenDaysAgo,
        },
        enrolment: {
          status: { in: ["ACTIVE", "COMPLETED"] },
          programme: {
            status: "ACTIVE", // Only active programmes
          },
          enrolledAt: {
            lte: sevenDaysAgo, // Candidate must be enrolled for at least 7 days
          },
        },
      },
      include: {
        enrolment: {
          include: {
            candidate: true,
            programme: true,
          },
        },
      },
      distinct: ["enrolmentId"],
    });

    const processedEnrolments = new Set<string>();
    let sent = 0;

    for (const progress of inactiveProgress) {
      const enrolmentId = progress.enrolmentId;
      if (processedEnrolments.has(enrolmentId)) continue;
      processedEnrolments.add(enrolmentId);

      const { enrolment } = progress;
      try {
        await sendTransactionalEmailByTemplate("re-engagement-reminder-7day", enrolment.candidate.email, {
          firstName: getFirstName(enrolment.candidate.firstName),
          programmeName: enrolment.programme.title,
          lastActivityDays: 7,
          portalUrl: `${process.env.NEXTAUTH_URL}/portal/programmes/${enrolment.programmeId}`,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear: new Date().getFullYear(),
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send re-engagement-7day to ${enrolment.candidate.email}:`, error);
      }
    }

    console.log(`[cron] re-engagement-reminder-7day: sent ${sent}/${processedEnrolments.size}`);
  } catch (error) {
    console.error("[cron] re-engagement-reminder-7day job failed:", error);
  }
}

/**
 * Exam Window Opened - Candidate Notification
 * Sends to all eligible candidates when an exam window opens.
 * Should be called when a new exam window is created OR run periodically to catch windows that opened.
 */
export async function sendExamWindowOpenedCandidateNotifications(examWindowId?: string) {
  try {
    let windows;

    if (examWindowId) {
      // Specific window provided
      windows = await prisma.examWindow.findMany({
        where: { id: examWindowId },
        include: {
          exam: {
            include: { programme: true },
          },
        },
      });
    } else {
      // Find recently opened windows (opened in last hour)
      const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
      windows = await prisma.examWindow.findMany({
        where: {
          createdAt: { gte: oneHourAgo },
        },
        include: {
          exam: {
            include: { programme: true },
          },
        },
      });
    }

    let totalSent = 0;
    for (const window of windows) {
      // Find eligible candidates (enrolled in the programme)
      const enrolments = await prisma.enrolment.findMany({
        where: {
          programmeId: window.exam.programmeId,
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
        include: {
          candidate: true,
        },
        distinct: ["candidateId"],
      });

      for (const enrolment of enrolments) {
        try {
          await sendTransactionalEmailByTemplate("exam-window-opened-candidate", enrolment.candidate.email, {
            firstName: getFirstName(enrolment.candidate.firstName),
            programmeName: window.exam.programme.title,
            tier: window.exam.programme.tier,
            examDate: window.opensAt.toLocaleDateString(),
            windowOpenDate: window.opensAt.toLocaleDateString(),
            windowCloseDate: window.closesAt.toLocaleDateString(),
            examDuration: `${window.exam.durationMinutes} minutes`,
            registrationUrl: `${process.env.NEXTAUTH_URL}/portal/exams`,
            admissionSlipUrl: `${process.env.NEXTAUTH_URL}/exams/${window.id}/admission-slip`,
            examRulesUrl: `${process.env.NEXTAUTH_URL}/exams/rules`,
            supportEmail: EMAIL_CONFIG.supportEmail,
            currentYear: new Date().getFullYear(),
          });
          totalSent++;
        } catch (error) {
          console.error(`Failed to send exam-window-opened-candidate to ${enrolment.candidate.email}:`, error);
        }
      }
    }

    console.log(`[cron] exam-window-opened-candidate: sent ${totalSent} emails across ${windows.length} windows`);
  } catch (error) {
    console.error("[cron] exam-window-opened-candidate job failed:", error);
  }
}

/**
 * Exam Window Opened - Staff Notification
 * Sends to relevant staff when an exam window opens.
 * Should be called when a new exam window is created.
 */
export async function sendExamWindowOpenedStaffNotifications(examWindowId?: string) {
  try {
    let windows;

    if (examWindowId) {
      windows = await prisma.examWindow.findMany({
        where: { id: examWindowId },
        include: {
          exam: {
            include: { programme: true },
          },
        },
      });
    } else {
      const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
      windows = await prisma.examWindow.findMany({
        where: { createdAt: { gte: oneHourAgo } },
        include: {
          exam: {
            include: { programme: true },
          },
        },
      });
    }

    let totalSent = 0;
    for (const window of windows) {
      // Find staff with MANAGE_EXAMS or MARK_SUBMISSIONS permissions
      const staff = await prisma.staff.findMany({
        where: {
          permissionGrants: {
            some: {
              permission: {
                in: ["MANAGE_EXAMS", "MARK_SUBMISSIONS"],
              },
            },
          },
          status: "ACTIVE",
        },
      });

      for (const staffMember of staff) {
        try {
          await sendTransactionalEmailByTemplate("exam-window-opened-staff", staffMember.email, {
            staffFirstName: getFirstName(staffMember.name),
            programmeName: window.exam.programme.title,
            tier: window.exam.programme.tier,
            role: staffMember.role,
            examDate: window.opensAt.toLocaleDateString(),
            windowOpenDate: window.opensAt.toLocaleDateString(),
            windowCloseDate: window.closesAt.toLocaleDateString(),
            registrationDeadline: window.registrationDeadline.toLocaleDateString(),
            examDuration: `${window.exam.durationMinutes} minutes`,
            adminUrl: `${process.env.NEXTAUTH_URL}/admin/exam-builder`,
            supportEmail: EMAIL_CONFIG.supportEmail,
            currentYear: new Date().getFullYear(),
          });
          totalSent++;
        } catch (error) {
          console.error(`Failed to send exam-window-opened-staff to ${staffMember.email}:`, error);
        }
      }
    }

    console.log(`[cron] exam-window-opened-staff: sent ${totalSent} emails across ${windows.length} windows`);
  } catch (error) {
    console.error("[cron] exam-window-opened-staff job failed:", error);
  }
}

/**
 * Initialize all cron jobs.
 * Call this during application startup to register all scheduled tasks.
 * Requires a scheduler to be implemented (e.g., node-cron, node-schedule, or serverless cron).
 */
export async function initializeCronJobs() {
  console.log("[cron] Cron jobs initialized. Scheduler integration required.");
  // This function is a placeholder for the actual scheduler setup.
  // Implement based on your chosen scheduler (node-cron, node-schedule, etc.)
}
