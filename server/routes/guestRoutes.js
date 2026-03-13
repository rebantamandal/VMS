import express from "express";
import {
  createGuests,
  getGuests,
  getGuestById,
  updateGuest,
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

// DELETE GUEST
router.delete("/:id", deleteGuest);
router.put("/:id/remove-ui", removeGuestFromUI);

export default router; // ✅ ESM default export
