import Visitor from "../models/Visitor.js";
import AdhocVisitor from "../models/Adhoc.js";
import { sendOverstayEmailToHost } from "../email/emailservice.js";

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

export async function runOverstayReminderJob() {
  try {
    // Only check people who are currently inside
    const [visitors, adhocs] = await Promise.all([
      Visitor.find({
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
      `✅ Overstay reminder job complete. Checked Visitors=${visitors.length}, Adhoc=${adhocs.length}`
    );
  } catch (err) {
    console.error("❌ Overstay reminder job failed:", err.message);
  }
}
