import express from "express";
import Visitor from "../models/Visitor.js";

const router = express.Router();

/* =========================
   Create Visitor
========================= */
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
    const updated = await Visitor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* =========================
   Soft Remove (UI Remove)
========================= */
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

export default router;   // ✅ VERY IMPORTANT
