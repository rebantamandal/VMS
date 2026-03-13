import mongoose from "mongoose";

const AdhocSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Adhoc"],
      required: true,
    },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },

    company: { type: String, required: true },
    countryCode: { type: String, default: "+91" },

    phone: {
      type: String,
      required: true,
    },

    purposeOfVisit: { type: String, required: true },

    host: { type: String, required: true },
    laptopSerial: { type: String },
    guestWifiRequired: { type: Boolean, default: false },

    cardNo: { type: String },

    inTime: { type: Date },
    outTime: { type: Date },

    actualInTime: { type: Date },
    actualOutTime: { type: Date },

    signature: { type: String },

    badgeSurrendered: { type: Boolean, default: false },
    hostApproved: { type: Boolean, default: false },

    submittedBy: { type: String },

    reminder15Sent: { type: Boolean, default: false },
    reminder15SentAt: { type: Date, default: null },
    reminder15SentForOutTime: { type: Date, default: null },


    status: {
      type: String,
      enum: ["new", "checkedIn", "checkedOut", "Authorized", "removed"], // ✅ CHANGED: added "removed"
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

    // ✅ AUTO-DELETION FIELD (TTL – 1 year after check-in)
    deleteAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

const AdhocVisitor = mongoose.model("AdhocVisitor", AdhocSchema);

export default AdhocVisitor;
