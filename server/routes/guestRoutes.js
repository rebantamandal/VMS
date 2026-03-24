import express from "express";
import {
  createGuests,
  getGuests,
  getGuestById,
  updateGuest,
  // -----------------changed by rebanta--------------
  // Added controller for guest daily pass issue/return event recording
  addGuestPassEvent,
  // -------------------------------------------------
  deleteGuest,
  removeGuestFromUI,
} from "../controllers/guestController.js"; // make sure controller is also ESM

const router = express.Router();

// CREATE (Multiple guests allowed)
router.post("/", createGuests);

// GET ALL GUESTS
router.get("/", getGuests);

// GET SINGLE GUEST
router.get("/:id", getGuestById);

// UPDATE GUEST
router.put("/:id", updateGuest);

// -----------------changed by rebanta--------------
// New route for recording guest daily pass issue/return actions
router.post("/:id/pass-events", addGuestPassEvent);
// -------------------------------------------------

// DELETE GUEST
router.delete("/:id", deleteGuest);
router.put("/:id/remove-ui", removeGuestFromUI);

export default router; // ✅ ESM default export
