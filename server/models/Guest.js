import mongoose from "mongoose";

// -----------------changed by rebanta--------------
// New embedded schema for daily pass issue/return history stored directly on each guest record
const dailyPassEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["issued", "returned"],
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    recordedBy: {
      type: String,
      default: "Security",
      trim: true,
    },
    badgeNoAtEvent: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);
// -------------------------------------------------

const guestSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Isuzu Employee", "UD Employee"],
      required: true,
    },

    firstName: { type: String, required: true },
    lastName: { type: String, default: "" },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },

    company: { type: String, default: "" },

    host: { type: String, required: true, trim: true },
    onBehalfOf: { type: Boolean, default: false },

    countryCode: { type: String, default: "+91" },

    phone: {
      type: String,
      required: true,
    },

    purposeOfVisit: { type: String, default: "" },

    meetingRoomRequired: { type: Boolean, default: false },
    meetingRoom: { type: String, default: "" },

    laptopSerial: { type: String, default: "" },

    guestWifiRequired: { type: Boolean, default: false },

    refreshmentRequired: { type: Boolean, default: false },
    proposedRefreshmentTime: { type: Date, default: null },

    inTime: { type: Date, required: true },
    outTime: { type: Date, required: true },

    actualInTime: { type: Date },
    actualOutTime: { type: Date },

    cardNo: { type: String },

    signature: { type: String },

    badgeSurrendered: { type: Boolean, default: false },
    hostApproved: { type: Boolean, default: false },

    submittedBy: { type: String },

    // -----------------changed by rebanta--------------
    // New pass-tracking fields: dailyPassEvents stores issue/return history and
    // dailyPassAlertDates records which IST dates already triggered a host alert
    dailyPassEvents: {
      type: [dailyPassEventSchema],
      default: [],
    },

    dailyPassAlertDates: {
      type: [String],
      default: [],
    },
    // -------------------------------------------------

    status: {
      type: String,
      enum: ["new", "approved", "rejected", "checkedIn", "checkedOut", "removed"], // ✅ CHANGED: added removed
      default: "new",
    },

    // ✅ NEW: End-to-end UI removal flag
    uiRemoved: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ✅ NEW: optional metadata
    removedAt: { type: Date, default: null },
    removedReason: { type: String, default: "" },

    deleteAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

const Guest = mongoose.model("Guest", guestSchema);

export default Guest;
