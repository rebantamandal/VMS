import { getDeleteDateAfterOneYear } from "../utils/dateUtils.js";
import Guest from "../models/Guest.js";
import { sendGuestWifiEmail, sendMeetingRoomEmail, sendRefreshmentEmail } from "../email/emailservice.js";
// -----------------changed by rebanta--------------
// Added pass-tracking helpers to support initial pass issuance, atomic pass event writes,
// and final-day checkout validation for repeated guests
import {
  addPassEventAtomic,
  ensureInitialPassIssued,
  requiresFinalDayPassReturnBeforeCheckout,
} from "../utils/passTracking.js";
// -------------------------------------------------

// CREATE MULTIPLE GUESTS
export const createGuests = async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Request body must be an array." });
    }

    const guests = await Guest.insertMany(req.body);

    for (const guest of guests) {
      if (guest.guestWifiRequired === true) {
        await sendGuestWifiEmail(guest);
      }
      if (guest.meetingRoomRequired === true) {
        await sendMeetingRoomEmail(guest);
      }
      if (guest.refreshmentRequired === true) {
        await sendRefreshmentEmail(guest);
      }
    }

    res.status(201).json({ message: "Guests added successfully", guests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ CHANGED: GET ALL GUESTS (exclude removed end-to-end)
export const getGuests = async (req, res) => {
  try {
    const guests = await Guest.find({ uiRemoved: { $ne: true } }); // ✅ CHANGED
    res.json(guests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET SINGLE GUEST BY ID
export const getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    res.json(guest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE GUEST
export const updateGuest = async (req, res) => {
  try {
    // -----------------changed by rebanta--------------
    // Refactored update flow: load the guest first, block final-day checkout until today's
    // pass is returned, apply updates in-memory, and auto-seed initial pass issuance on first check-in
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const updateData = { ...req.body };
    const wasCheckedIn = guest.status === "checkedIn";
    if (
      // Blocks direct final-day checkout until today's pass has been returned.
      updateData.status === "checkedOut" &&
      wasCheckedIn &&
      requiresFinalDayPassReturnBeforeCheckout(guest)
    ) {
      return res.status(400).json({
        error: "Complete today's Issue Pass and Return Pass before final checkout.",
      });
    }

    if (updateData.status === "checkedIn" && !updateData.actualInTime) {
      updateData.actualInTime = new Date();
      updateData.deleteAt = getDeleteDateAfterOneYear(updateData.actualInTime);

      console.log(
        `🗑️ Guest ${req.params.id} will be automatically deleted on:`,
        updateData.deleteAt.toISOString()
      );
    }

    if (updateData.status === "checkedOut" && !updateData.actualOutTime) {
      updateData.actualOutTime = new Date();
    }

    Object.assign(guest, updateData);

    if (!wasCheckedIn && guest.status === "checkedIn") {
      ensureInitialPassIssued(guest);
    }

    await guest.save();
    // -------------------------------------------------

    res.json({ message: "Guest updated successfully", guest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// -----------------changed by rebanta--------------
// New endpoint: records guest pass issue/return actions atomically and returns the updated record
export const addGuestPassEvent = async (req, res) => {
  try {
    const result = await addPassEventAtomic({
      Model: Guest,
      recordId: req.params.id,
      action: req.body?.action,
      recordedBy: req.body?.recordedBy || "Security",
    });

    res.json({
      message: result.message,
      alreadyRecorded: result.alreadyRecorded,
      guest: result.record,
    });
  } catch (err) {
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Guest not found" });
    }
    res.status(400).json({ error: err.message });
  }
};
// -------------------------------------------------

// DELETE GUEST (unchanged)
export const deleteGuest = async (req, res) => {
  try {
    const guest = await Guest.findByIdAndDelete(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ NEW: Remove guest from UI end-to-end (no DB delete)
 * Allowed only if NOT authorized yet (guest must still be "new")
 * (If your "authorized" for guest is "checkedIn", this rule is correct)
 */
export const removeGuestFromUI = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    const g = await Guest.findById(id);
    if (!g) return res.status(404).json({ message: "Guest not found" });

    // ✅ Do NOT allow removing if already processed
    if (g.status !== "new") {
      return res.status(400).json({
        message: "Cannot remove. Guest already authorized/processed.",
      });
    }

    g.status = "removed";
    g.uiRemoved = true;
    g.removedAt = new Date();
    g.removedReason = reason || "";

    await g.save();

    return res.status(200).json({ message: "Guest removed from UI", guest: g });
  } catch (err) {
    console.error("[REMOVE GUEST UI] Error:", err);
    return res.status(500).json({ error: "Failed to remove guest from UI" });
  }
};
