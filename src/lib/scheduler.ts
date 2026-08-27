import "server-only";
import * as cron from "node-cron";
import {
  sendProfileCompletionReminders,
  sendReEngagementReminder3day,
  sendReEngagementReminder7day,
  sendExamWindowOpenedCandidateNotifications,
  sendExamWindowOpenedStaffNotifications,
} from "@/lib/cron-jobs";

let scheduler: {
  profileCompletion?: cron.ScheduledTask;
  reEngagement3day?: cron.ScheduledTask;
  reEngagement7day?: cron.ScheduledTask;
  examWindowCandidate?: cron.ScheduledTask;
  examWindowStaff?: cron.ScheduledTask;
} = {};

/**
 * Start all scheduled email jobs.
 * Should be called once during application startup.
 */
export function startScheduler() {
  // Profile Completion Reminder
  // Runs hourly to catch candidates at the 24h registration mark
  scheduler.profileCompletion = cron.schedule("0 * * * *", async () => {
    console.log("[scheduler] Running profile-completion-reminder job");
    await sendProfileCompletionReminders();
  });
  console.log("[scheduler] Profile completion reminder scheduled (hourly)");

  // Re-engagement Reminder (3 days)
  // Runs daily at 08:00 AM to catch inactive candidates
  scheduler.reEngagement3day = cron.schedule("0 8 * * *", async () => {
    console.log("[scheduler] Running re-engagement-reminder-3day job");
    await sendReEngagementReminder3day();
  });
  console.log("[scheduler] Re-engagement 3-day reminder scheduled (daily at 8 AM)");

  // Re-engagement Reminder (7 days)
  // Runs daily at 09:00 AM to catch very inactive candidates
  scheduler.reEngagement7day = cron.schedule("0 9 * * *", async () => {
    console.log("[scheduler] Running re-engagement-reminder-7day job");
    await sendReEngagementReminder7day();
  });
  console.log("[scheduler] Re-engagement 7-day reminder scheduled (daily at 9 AM)");

  // Exam Window Opened - Candidate Notifications
  // Runs every 30 minutes to catch newly opened exam windows
  scheduler.examWindowCandidate = cron.schedule("*/30 * * * *", async () => {
    console.log("[scheduler] Running exam-window-opened-candidate job");
    await sendExamWindowOpenedCandidateNotifications();
  });
  console.log("[scheduler] Exam window candidate notifications scheduled (every 30 min)");

  // Exam Window Opened - Staff Notifications
  // Runs every 30 minutes to catch newly opened exam windows
  scheduler.examWindowStaff = cron.schedule("*/30 * * * *", async () => {
    console.log("[scheduler] Running exam-window-opened-staff job");
    await sendExamWindowOpenedStaffNotifications();
  });
  console.log("[scheduler] Exam window staff notifications scheduled (every 30 min)");
}

/**
 * Stop all scheduled email jobs.
 * Useful for graceful shutdown or testing.
 */
export function stopScheduler() {
  Object.values(scheduler).forEach((task) => {
    if (task) task.stop();
  });
  console.log("[scheduler] All scheduled jobs stopped");
  scheduler = {};
}

/**
 * Trigger a specific job immediately (useful for testing or admin actions).
 */
export async function triggerJobImmediate(jobName: string, params?: Record<string, string>) {
  console.log(`[scheduler] Triggering ${jobName} immediately`);

  switch (jobName) {
    case "profile-completion-reminder":
      await sendProfileCompletionReminders();
      break;
    case "re-engagement-reminder-3day":
      await sendReEngagementReminder3day();
      break;
    case "re-engagement-reminder-7day":
      await sendReEngagementReminder7day();
      break;
    case "exam-window-opened-candidate":
      await sendExamWindowOpenedCandidateNotifications(params?.examWindowId);
      break;
    case "exam-window-opened-staff":
      await sendExamWindowOpenedStaffNotifications(params?.examWindowId);
      break;
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }

  console.log(`[scheduler] ${jobName} completed`);
}
