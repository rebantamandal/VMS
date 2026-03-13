import { getDeleteDateAfterOneYear } from "../utils/dateUtils.js";
import Visitor from "../models/Visitor.js";
import { sendGuestWifiEmail } from "../email/emailservice.js";

// Create multiple visitors
export const createVisitors = async (req, res) => {
  console.log("✅ Received request to create visitors:", req.body);

  try {
    const visitors = Array.isArray(req.body) ? req.body : [req.body];

    if (visitors.length === 0) {
      console.warn("⚠️ No visitor data provided in request body");
      return res.status(400).json({ error: "No visitor data provided" });
    }

    console.log(`ℹ️ Attempting to insert ${visitors.length} visitor(s) into DB...`);

    const savedVisitors = await Visitor.insertMany(visitors, { ordered: true });
    console.log("✅ Visitors successfully saved to DB:", savedVisitors);

    for (const visitor of savedVisitors) {
      if (visitor.guestWifiRequired === true) {
        console.log(`✉️ Sending guest Wi-Fi email to: ${visitor.email}`);
        try {
          await sendGuestWifiEmail(visitor);
          console.log(`✅ Email sent successfully to ${visitor.email}`);
        } catch (emailErr) {
          console.error(`❌ Failed to send Wi-Fi email to ${visitor.email}:`, emailErr.message);
        }
      }
    }

    res.status(201).json(savedVisitors);
  } catch (err) {
    console.error("❌ Error creating visitors:", err);

    if (err.name === "ValidationError" || err.name === "BulkWriteError") {
      console.warn("⚠️ Validation or bulk write error:", err.message);
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: "Failed to create visitors" });
  }
};

// ✅ CHANGED: Get all visitors (hide uiRemoved ones)
export const getVisitors = async (req, res) => {
  console.log("✅ Received request to fetch all visitors");

  try {
    // ✅ CHANGED: exclude removed from UI for everyone
    const visitors = await Visitor.find({ uiRemoved: { $ne: true } });

    console.log(`ℹ️ Retrieved ${visitors.length} visitor(s) from DB`);
    res.status(200).json(visitors);
  } catch (err) {
    console.error("❌ Error fetching visitors:", err);
    res.status(500).json({ error: "Failed to fetch visitors" });
  }
};

// Update a visitor
export const updateVisitor = async (req, res) => {
  const { id } = req.params;
  console.log(`✅ Received request to update visitor with ID: ${id}`);
  console.log("ℹ️ Update data:", req.body);

  try {
    const updateData = { ...req.body };

    if (updateData.status === "checkedIn" && !updateData.actualInTime) {
      updateData.actualInTime = new Date();
      updateData.deleteAt = getDeleteDateAfterOneYear(updateData.actualInTime);

      console.log(
        `🗑️ Visitor ${id} will be automatically deleted on:`,
        updateData.deleteAt.toISOString()
      );
    }

    if (updateData.status === "checkedOut" && !updateData.actualOutTime) {
      updateData.actualOutTime = new Date();
      console.log(`ℹ️ Auto-set actualOutTime for visitor ${id}:`, updateData.actualOutTime);
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



    const updated = await Visitor.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });


    if (!updated) {
      console.warn(`⚠️ Visitor not found with ID: ${id}`);
      return res.status(404).json({ message: "Visitor not found" });
    }

    console.log("✅ Visitor updated successfully:", updated);
    res.status(200).json(updated);
  } catch (err) {
    console.error("❌ Error updating visitor:", err);

    if (err.name === "ValidationError") {
      console.warn("⚠️ Validation error:", err.message);
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: "Failed to update visitor" });
  }
};

/**
 * ✅ NEW: Remove visitor from UI for everyone (does NOT delete DB)
 * Only allowed if visitor is NOT authorized (status still "new")
 */
export const removeVisitorFromUI = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    const v = await Visitor.findById(id);
    if (!v) return res.status(404).json({ message: "Visitor not found" });

    // ✅ Ensure authorized users are NOT removed
    if (v.status !== "new") {
      return res.status(400).json({
        message: "Cannot remove. Visitor already authorized/processed.",
      });
    }

    v.status = "removed"; // ✅ mark removed
    v.uiRemoved = true;   // ✅ hide from UI for everyone
    v.removedAt = new Date();
    v.removedReason = reason || "";

    await v.save();

    return res.status(200).json({ message: "Visitor removed from UI", visitor: v });
  } catch (err) {
    console.error("❌ Error removing visitor from UI:", err);
    return res.status(500).json({ error: "Failed to remove visitor from UI" });
  }
};
