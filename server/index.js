import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB, dbStatus } from "./db.js";

import visitorRoutes from "./routes/visitorRoutes.js";
import guestRoutes from "./routes/guestRoutes.js";
import adhocRoutes from "./routes/adhocRoutes.js";

import errorHandler from "./middleware/errorHandler.js";
import { runOverstayReminderJob } from "./jobs/overstayReminderJob.js";

/* =========================
   Load Environment Variables
========================= */
dotenv.config();

/* =========================
   App Initialization
========================= */
const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   Middleware
========================= */

// Enable CORS (Frontend → Backend)
app.use(
  cors({
    origin: process.env.CORS_ORIGINS || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Parse JSON body
app.use(express.json());

/* =========================
   Health Check Routes
========================= */

app.get("/", (req, res) => {
  res.status(200).json({
    status: "Backend is running 🚀",
    database: dbStatus,
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "Backend is running 🚀",
    database: dbStatus,
  });
});

/* =========================
   API Routes
========================= */

app.use("/api/visitors", visitorRoutes);
app.use("/api/guests", guestRoutes);
app.use("/api/adhoc", adhocRoutes);

/* =========================
   Error Handler
========================= */
app.use(errorHandler);

/* =========================
   Start Server AFTER DB Connection
========================= */

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    /* =========================
       Background Jobs
    ========================= */

    // Run immediately
    runOverstayReminderJob();

    // Run every 60 seconds
    setInterval(() => {
      runOverstayReminderJob();
    }, 60 * 1000);

  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
  }
};

startServer();
