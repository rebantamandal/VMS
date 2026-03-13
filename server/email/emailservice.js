// server/email/emailService.js

import { EmailClient } from "@azure/communication-email";
import dotenv from "dotenv";

/* ----------------------------------------------------
   Load .env only in local / non-production
---------------------------------------------------- */
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

/* ----------------------------------------------------
   OPTIONAL: TLS override (ONLY for local debugging)
---------------------------------------------------- */
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/* ----------------------------------------------------
   Lazy-loaded Email Client (prevents startup crash)
---------------------------------------------------- */
let emailClient = null;

function getEmailClient() {
  if (!emailClient) {
    if (!process.env.ACS_CONNECTION_STRING) {
      throw new Error("ACS_CONNECTION_STRING is missing");
    }
    emailClient = new EmailClient(process.env.ACS_CONNECTION_STRING);
  }
  return emailClient;
}

/* ----------------------------------------------------
   COMMON SEND FUNCTION
---------------------------------------------------- */
async function sendEmail(message) {
  try {
    const client = getEmailClient();
    const poller = await client.beginSend(message);
    await poller.pollUntilDone();
  } catch (error) {
    console.error("ACS EMAIL ERROR:", error.message);
  }
}

/* ====================== WIFI EMAIL ====================== */
export async function sendGuestWifiEmail(visitor) {
  const name = `${visitor.firstName || ""} ${visitor.lastName || ""}`.trim() || "Visitor";
  const inTime = visitor.inTime ? new Date(visitor.inTime).toLocaleString("en-IN") : "Not Provided";
  const outTime = visitor.outTime ? new Date(visitor.outTime).toLocaleString("en-IN") : "Not Provided";

  const subject = "Guest Wi-Fi Access Request";

  const message = {
    senderAddress: process.env.ACS_SENDER_EMAIL,
    recipients: {
      to: [
        {
          address: "ppdlguestwifi@udtrucks.com",
          displayName: "IT Support Team",
        },
      ],
      cc: [
        {
          address: visitor.submittedBy,
          displayName: "Submitted By",
        },
      ],
    },
    content: {
      subject,
      html: `
        <p>Hello <strong>Vishal</strong>,</p>

        <p>This is an automated request from <strong>Facilo</strong>.</p>

        <p>
          Guest Wi-Fi access has been requested by <strong>${visitor.submittedBy}</strong>.
        </p>

        <p><b>Details:</b></p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Email:</b> ${visitor.email || "N/A"}</li>
          <li><b>Company:</b> ${visitor.company || "N/A"}</li>
          <li><b>Check-in:</b> ${inTime}</li>
          <li><b>Check-out:</b> ${outTime}</li>
        </ul>

        <p>Regards,<br/>UD Trucks India – VMS</p>
      `,
      plainText: `Guest Wi-Fi request for ${name}`,
    },
  };

  await sendEmail(message);
}

/* ====================== ADHOC WIFI EMAIL ====================== */
export async function sendAdhocWifiEmail(visitor) {
  const name = `${visitor.firstName || ""} ${visitor.lastName || ""}`.trim() || "Visitor";
  const inTime = visitor.inTime ? new Date(visitor.inTime).toLocaleString("en-IN") : "Not Provided";
  const outTime = visitor.outTime ? new Date(visitor.outTime).toLocaleString("en-IN") : "Not Provided";

  const subject = "Adhoc Visitor – Guest Wi-Fi Request";

  const message = {
    senderAddress: process.env.ACS_SENDER_EMAIL,
    recipients: {
      to: [
        {
          address: "ppdlguestwifi@udtrucks.com",
          displayName: "IT Support Team",
        },
      ],
      cc: [
        {
          address: visitor.submittedBy,
          displayName: "Submitted By",
        },
      ],
    },
    headers: {
      Importance: "High",
      "X-Priority": "1",
    },
    content: {
      subject,
      html: `
        <p>Hello Team,</p>

        <p>This is an automated request from <strong>Facilo</strong>.</p>

        <p>
          An adhoc visitor is requesting Guest Wi-Fi access.
        </p>

        <p><b>Details:</b></p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Email:</b> ${visitor.email || "N/A"}</li>
          <li><b>Company:</b> ${visitor.company || "N/A"}</li>
          <li><b>Check-in:</b> ${inTime}</li>
          <li><b>Check-out:</b> ${outTime}</li>
        </ul>

        <p>Regards,<br/>UD Trucks India – VMS</p>
      `,
      plainText: `Adhoc Wi-Fi request for ${name}`,
    },
  };

  await sendEmail(message);
}

/* ====================== MEETING ROOM EMAIL ====================== */
export async function sendMeetingRoomEmail(visitor) {
  const name = `${visitor.firstName || ""} ${visitor.lastName || ""}`.trim() || "Visitor";
  const inTime = visitor.inTime ? new Date(visitor.inTime).toLocaleString("en-IN") : "Not Provided";
  const outTime = visitor.outTime ? new Date(visitor.outTime).toLocaleString("en-IN") : "Not Provided";

  const subject = "Meeting Room Booking – Guest Request";

  const message = {
    senderAddress: process.env.ACS_SENDER_EMAIL,
    recipients: {
      to: [
        {
          address: "admin.helpdesk@udtrucks.com ",
          displayName: "Admin Team",
        },
      ],
      cc: [
        {
          address: visitor.submittedBy,
          displayName: "Submitted By",
        },
      ],
    },
    content: {
      subject,
      html: `
        <p>Hello Team,</p>

        <p>This is an automated request from <strong>Facilo</strong>.</p>

        <p>
          A meeting room has been requested by <strong>${visitor.submittedBy}</strong>.
        </p>

        <p><b>Details:</b></p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Meeting Room:</b> ${visitor.meetingRoom}</li>
          <li><b>Purpose:</b> ${visitor.purposeOfVisit}</li>
          <li><b>In Time:</b> ${inTime}</li>
          <li><b>Out Time:</b> ${outTime}</li>
        </ul>

        <p>Regards,<br/>UD Trucks India – VMS</p>
      `,
      plainText: `Meeting room requested for ${name}`,
    },
  };

  await sendEmail(message);
}

/* ====================== REFRESHMENT EMAIL ====================== */
export async function sendRefreshmentEmail(visitor) {
  const name = `${visitor.firstName || ""} ${visitor.lastName || ""}`.trim() || "Visitor";
  const proposedTime = visitor.proposedRefreshmentTime
    ? new Date(visitor.proposedRefreshmentTime).toLocaleString("en-IN")
    : "Not Provided";

  const subject = "Refreshment Request – Guest";

  const message = {
    senderAddress: process.env.ACS_SENDER_EMAIL,
    recipients: {
      to: [
        {
          address: "admin.helpdesk@udtrucks.com ",
          displayName: "Admin Team",
        },
      ],
      cc: [
        {
          address: visitor.submittedBy,
          displayName: "Submitted By",
        },
      ],
    },
    content: {
      subject,
      html: `
        <p>Hello Team,</p>

        <p>This is an automated request from <strong>Facilo</strong>.</p>

        <p>
          A refreshment request has been made by <strong>${visitor.submittedBy}</strong>.
        </p>

        <p><b>Details:</b></p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Company:</b> ${visitor.category || "N/A"}</li>
          <li><b>Proposed Time:</b> ${proposedTime}</li>
        </ul>

        <p>Regards,<br/>UD Trucks India – VMS</p>
      `,
      plainText: `Refreshment requested for ${name}`,
    },
  };

  await sendEmail(message);
}

// checkout time
export async function sendOverstayEmailToHost({ type, visitor, toHostEmail }) {
  if (!toHostEmail) {
    console.warn("⚠️ No host email provided; cannot send reminder.");
    return;
  }

  const name = `${visitor.firstName || ""} ${visitor.lastName || ""}`.trim() || "Visitor";
  const hostName = visitor.host || "Host";
  const outTime = visitor.outTime ? new Date(visitor.outTime).toLocaleString("en-IN") : "N/A";
  const now = new Date().toLocaleString("en-IN");

  const subject = `Overstay Alert: ${name} has exceeded scheduled check-out time`;

  const message = {
    senderAddress: process.env.ACS_SENDER_EMAIL,
    recipients: {
      to: [
        {
          address: visitor.submittedBy,
          displayName: "Submitted By",
        },
      ],
      cc: [
        {
          address: "group.id.a383968@udtrucks.com",
          displayName: "Security Team",
        },
      ],
    },
    content: {
      subject,
      html: `
        <p>Hello <strong>${hostName}</strong>,</p>

        <p>This is an automated reminder from <strong>Facilo</strong>.</p>

        <p>
          The ${type} <strong>${name}</strong> has exceeded the tentative check-out time by more than <strong>90 minutes</strong>.
        </p>

        <p><b>Details:</b></p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Category:</b> ${visitor.category || "-"}</li>
          <li><b>Company:</b> ${visitor.company || "-"}</li>
          <li><b>Tentative Check-out:</b> ${outTime}</li>
          <li><b>Current Time:</b> ${now}</li>
        </ul>

        <p>Please ensure that the visitor leaves the premises, or inform Security in advance if their presence needs to be extended.</p>

        <p>Regards,<br/>UD Trucks India – VMS</p>
      `,
      plainText: `${subject} | Tentative out: ${outTime} | Now: ${now}`,
    },
  };

  await sendEmail(message);
}