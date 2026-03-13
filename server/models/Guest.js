import mongoose from "mongoose";

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
