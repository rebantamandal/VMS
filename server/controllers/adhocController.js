import { getDeleteDateAfterOneYear } from "../utils/dateUtils.js";
import AdhocVisitor from "../models/Adhoc.js";
import { sendAdhocWifiEmail } from "../email/emailservice.js";

// Create multiple adhoc visitors
export const createAdhocVisitors = async (req, res) => {
  try {
    const visitors = Array.isArray(req.body) ? req.body : [req.body];

    const saved = await AdhocVisitor.insertMany(visitors);

    for (const visitor of saved) {
      if (visitor.guestWifiRequired) {
        await sendAdhocWifiEmail(visitor);
      }
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error("[CREATE ADHOC VISITORS] Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ CHANGED: Get all adhoc visitors (exclude removed from UI end-to-end)
export const getAdhocVisitors = async (req, res) => {
  try {
    const visitors = await AdhocVisitor.find({ uiRemoved: { $ne: true } }); // ✅ CHANGED
    res.status(200).json(visitors);
  } catch (err) {
    console.error("[GET ADHOC VISITORS] Error:", err);
    res.status(500).json({ error: "Failed to fetch adhoc visitors" });
  }
};

// Update adhoc visitor
export const updateAdhocVisitor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Auto set actual check-in/out times
    if (updateData.status === "checkedIn" && !updateData.actualInTime) {
      updateData.actualInTime = new Date();
      updateData.deleteAt = getDeleteDateAfterOneYear(updateData.actualInTime);

      console.log(
        `🗑️ Adhoc Visitor ${id} will be automatically deleted on:`,
        updateData.deleteAt.toISOString()
      );
    }

    if (updateData.status === "checkedOut" && !updateData.actualOutTime) {
      updateData.actualOutTime = new Date();
    }


    // If outTime changed, allow reminder again for the new outTime
if (updateData.outTime) {
  updateData.reminder15Sent = false;
  updateData.reminder15SentAt = null;
  updateData.reminder15SentForOutTime = null;
}

// If checkedOut, reset reminder flags (optional cleanup)
if (updateData.status === "checkedOut") {
  updateData.reminder15Sent = false;
  updateData.reminder15SentAt = null;
  updateData.reminder15SentForOutTime = null;
}


    const updated = await AdhocVisitor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Adhoc visitor not found" });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("[UPDATE ADHOC VISITOR] Error:", err);
    res.status(500).json({ message: "Failed to update adhoc visitor" });
  }
};

/**
 * ✅ NEW: Remove adhoc visitor from UI end-to-end (no DB delete)
 * Rule: allowed only if NOT authorized (status must still be "new")
 */
export const removeAdhocVisitorFromUI = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    const v = await AdhocVisitor.findById(id);
    if (!v) return res.status(404).json({ message: "Adhoc visitor not found" });

    // ✅ do NOT allow removal if already authorized/processed
    if (v.status !== "new") {
      return res.status(400).json({
        message: "Cannot remove. Adhoc visitor already authorized/processed.",
      });
    }

    v.status = "removed";     // ✅ mark removed
    v.uiRemoved = true;       // ✅ hide for everyone
    v.removedAt = new Date(); // ✅ optional
    v.removedReason = reason || "";

    await v.save();

    return res.status(200).json({ message: "Adhoc visitor removed from UI", visitor: v });
  } catch (err) {
    console.error("[REMOVE ADHOC VISITOR UI] Error:", err);
    return res.status(500).json({ error: "Failed to remove adhoc visitor from UI" });
  }
};
