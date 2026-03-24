import express from "express";
// -----------------changed by rebanta--------------
// Replaced controller-based routing with direct model-based route handlers plus pass-tracking
// and checkout-email helpers used by the inline visitor endpoints below
import Visitor from "../models/Visitor.js";
import {
  addPassEventAtomic,
  ensureInitialPassIssued,
  requiresFinalDayPassReturnBeforeCheckout,
} from "../utils/passTracking.js";
import { resolveOfficialHostEmail, sendCheckoutEmailToHost } from "../email/emailservice.js";
// -------------------------------------------------

const router = express.Router();

/* =========================
   Create Visitor
========================= */
// -----------------changed by rebanta--------------
// Replaced controller import usage with inline create/get/update handlers so pass-tracking
// and checkout email behavior can be handled directly in this route module
router.post("/", async (req, res) => {
  try {
    const visitors = await Visitor.insertMany(req.body);
    res.status(201).json(visitors);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* =========================
   Get All Visitors
========================= */
router.get("/", async (req, res) => {
  try {
    const visitors = await Visitor.find({ uiRemoved: false });
    res.json(visitors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   Update Visitor
========================= */
router.put("/:id", async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    const wasCheckedIn = visitor.status === "checkedIn";
    const wasCheckedOut = visitor.status === "checkedOut";
    if (
      // Blocks direct final-day checkout until today's pass has been returned.
      req.body?.status === "checkedOut" &&
      wasCheckedIn &&
      requiresFinalDayPassReturnBeforeCheckout(visitor)
    ) {
      return res.status(400).json({
        error: "Complete today's Issue Pass and Return Pass before final checkout.",
      });
    }

    Object.assign(visitor, req.body);

    if (visitor.status === "checkedIn" && !visitor.actualInTime) {
      visitor.actualInTime = new Date();
    }

    if (visitor.status === "checkedOut" && !visitor.actualOutTime) {
      visitor.actualOutTime = new Date();
    }

    if (!wasCheckedIn && visitor.status === "checkedIn") {
      ensureInitialPassIssued(visitor);
    }

    await visitor.save();

    if (!wasCheckedOut && visitor.status === "checkedOut") {
      const toHostEmail = resolveOfficialHostEmail(visitor);
      await sendCheckoutEmailToHost({
        type: "visitor",
        visitor,
        toHostEmail,
      });
    }

    res.json(visitor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// -------------------------------------------------

// -----------------changed by rebanta--------------
// New route for recording visitor daily pass issue/return actions
router.post("/:id/pass-events", async (req, res) => {
  try {
    const result = await addPassEventAtomic({
      Model: Visitor,
      recordId: req.params.id,
      action: req.body?.action,
      recordedBy: req.body?.recordedBy || "Security",
    });

    return res.status(200).json({
      message: result.message,
      alreadyRecorded: result.alreadyRecorded,
      visitor: result.record,
    });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Visitor not found" });
    }
    res.status(400).json({ error: error.message });
  }
});
// -------------------------------------------------

/* =========================
   Soft Remove (UI Remove)
========================= */
// -----------------changed by rebanta--------------
// Replaced PUT /:id/remove-ui controller route with inline PATCH /:id/remove soft-delete handler
router.patch("/:id/remove", async (req, res) => {
  try {
    const updated = await Visitor.findByIdAndUpdate(
      req.params.id,
      {
        uiRemoved: true,
        removedAt: new Date(),
        status: "removed"
      },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Backward-compatible alias for existing frontend calls.
router.put("/:id/remove-ui", async (req, res) => {
  try {
    const updated = await Visitor.findByIdAndUpdate(
      req.params.id,
      {
        uiRemoved: true,
        removedAt: new Date(),
        status: "removed"
      },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// -------------------------------------------------

export default router;   // ✅ VERY IMPORTANT
