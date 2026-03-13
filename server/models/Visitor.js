import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Visitor"],
      required: true,
    },

    host: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    onBehalfOf: {
      type: Boolean,
      default: false,
    },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: (props) =>
          `${props.value} is not a valid email address!`,
      },
      index: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    countryCode: {
      type: String,
      default: "+91",
    },

    phone: {
      type: String,
      required: true,
      index: true,
    },

    purposeOfVisit: {
      type: String,
      required: true,
    },

    meetingRoom: { type: String },
    laptopSerial: { type: String },

    guestWifiRequired: {
      type: Boolean,
      default: false,
    },

    cardNo: { type: String },

    inTime: { type: Date },
    outTime: { type: Date },

    actualInTime: { type: Date },
    actualOutTime: { type: Date },

    signature: { type: String },

    badgeSurrendered: {
      type: Boolean,
      default: false,
    },

    hostApproved: {
      type: Boolean,
      default: false,
    },

    submittedBy: { type: String },

    /* =========================
       Reminder Tracking
    ========================= */
    reminder15Sent: {
      type: Boolean,
      default: false,
    },

    reminder15SentAt: {
      type: Date,
      default: null,
    },

    reminder15SentForOutTime: {
      type: Date,
      default: null,
    },

    /* =========================
       Status Handling
    ========================= */
    status: {
      type: String,
      enum: ["new", "checkedIn", "checkedOut", "Authorized", "removed"],
      default: "new",
      index: true,
    },

    /* =========================
       UI Removal (Soft Delete)
    ========================= */
    uiRemoved: {
      type: Boolean,
      default: false,
      index: true,
    },

    removedAt: {
      type: Date,
      default: null,
    },

    removedReason: {
      type: String,
      default: "",
    },

    /* =========================
       TTL Auto Delete
       (Mongo deletes document when time reached)
    ========================= */
    deleteAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

const Visitor = mongoose.model("Visitor", visitorSchema);

export default Visitor;
