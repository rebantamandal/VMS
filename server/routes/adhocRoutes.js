import express from "express";
import {
  createAdhocVisitors,
  getAdhocVisitors,
  updateAdhocVisitor,
  removeAdhocVisitorFromUI,
} from "../controllers/adhocController.js";

const router = express.Router();

router.post("/", createAdhocVisitors);
router.get("/", getAdhocVisitors);
router.put("/:id", updateAdhocVisitor);
router.put("/:id/remove-ui", removeAdhocVisitorFromUI);

export default router; // ✅ ESM default export
