import Visitor from "../models/Visitor.js";
import Guest from "../models/Guest.js";
import AdhocVisitor from "../models/Adhoc.js";
import { sendDailyPassReturnAlertEmail, sendOverstayEmailToHost } from "../email/emailservice.js";
import {
  formatPassTimestamp,
  getDailyPassEvents,
  getPassDateKey,
  hasIssuedWithoutReturnForDate,
  hasPassReturnAlertForDate,
  isPassTrackingDay,
  markPassReturnAlertSent,
} from "../utils/passTracking.js";

const PASS_RETURN_ALERT_HOUR_IST = Number(process.env.PASS_RETURN_ALERT_HOUR_IST || 20);

const hourFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  hour12: false,
});

// Helper: is overdue by 15 mins
function isOverdue15(outTime) {
  if (!outTime) return false;
  const outMs = new Date(outTime).getTime();
  return Date.now() > outMs + 90 * 60 * 1000;
}

// Host email resolver:
// - For visitors/adhoc you said “email to host”
// - In your UI, `host` seems to be a string; many orgs store host email in `submittedBy`.
// - Here we use: hostEmail = visitor.submittedBy (typical) OR visitor.hostEmail if exists.
function resolveHostEmail(v) {
  return v.hostEmail || v.submittedBy || null;
}

function getIstHour(date = new Date()) {
  const hourText = hourFormatter.format(date);
  const hour = Number.parseInt(hourText, 10);
  return Number.isNaN(hour) ? 0 : hour;
}

async function runDailyPassReturnAlerts(records, type, now) {
  const todayKey = getPassDateKey(now);
  if (!todayKey || getIstHour(now) < PASS_RETURN_ALERT_HOUR_IST) {
    return;
  }

  for (const record of records) {
    if (!isPassTrackingDay(record, now)) continue;
    if (!hasIssuedWithoutReturnForDate(record, todayKey)) continue;
    if (hasPassReturnAlertForDate(record, todayKey)) continue;

    const todayIssue = getDailyPassEvents(record).find(
      (event) => event?.action === "issued" && event?.dateKey === todayKey
    );

    await sendDailyPassReturnAlertEmail({
      type,
      visitor: record,
      toHostEmail: resolveHostEmail(record),
      issuedAt: formatPassTimestamp(todayIssue?.recordedAt),
      dateKey: todayKey,
    });

    markPassReturnAlertSent(record, todayKey);
    await record.save();
  }
}

export async function runOverstayReminderJob() {
  try {
    // Only check people who are currently inside
    const [visitors, guests, adhocs] = await Promise.all([
      Visitor.find({
        uiRemoved: { $ne: true },
        status: "checkedIn",
        outTime: { $ne: null },
      }),
      Guest.find({
        uiRemoved: { $ne: true },
        status: "checkedIn",
        outTime: { $ne: null },
      }),
      AdhocVisitor.find({
        uiRemoved: { $ne: true },
        status: "checkedIn",
        outTime: { $ne: null },
      }),
    ]);

    const now = new Date();

    await runDailyPassReturnAlerts(visitors, "visitor", now);
    await runDailyPassReturnAlerts(guests, "guest", now);

    // VISITORS
    for (const v of visitors) {
      const overdue = isOverdue15(v.outTime);
      if (!overdue) continue;

      const outTimeMs = new Date(v.outTime).getTime();
      const alreadySentForSameOutTime =
        v.reminder15Sent === true &&
        v.reminder15SentForOutTime &&
        new Date(v.reminder15SentForOutTime).getTime() === outTimeMs;

      if (alreadySentForSameOutTime) continue;

      const hostEmail = resolveHostEmail(v);
      await sendOverstayEmailToHost({
        type: "visitor",
        visitor: v,
        toHostEmail: hostEmail,
      });

      v.reminder15Sent = true;
      v.reminder15SentAt = new Date();
      v.reminder15SentForOutTime = v.outTime;
      await v.save();
    }

    // ADHOC VISITORS
    for (const a of adhocs) {
      const overdue = isOverdue15(a.outTime);
      if (!overdue) continue;

      const outTimeMs = new Date(a.outTime).getTime();
      const alreadySentForSameOutTime =
        a.reminder15Sent === true &&
        a.reminder15SentForOutTime &&
        new Date(a.reminder15SentForOutTime).getTime() === outTimeMs;

      if (alreadySentForSameOutTime) continue;

      const hostEmail = resolveHostEmail(a);
      await sendOverstayEmailToHost({
        type: "adhoc visitor",
        visitor: a,
        toHostEmail: hostEmail,
      });

      a.reminder15Sent = true;
      a.reminder15SentAt = new Date();
      a.reminder15SentForOutTime = a.outTime;
      await a.save();
    }

    console.log(
      `✅ Overstay reminder job complete. Checked Visitors=${visitors.length}, Guests=${guests.length}, Adhoc=${adhocs.length}`
    );
  } catch (err) {
    console.error("❌ Overstay reminder job failed:", err.message);
  }
}
