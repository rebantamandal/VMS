const PASS_TRACKING_TIME_ZONE = "Asia/Kolkata";
const PASS_ACTIONS = new Set(["issued", "returned"]);

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PASS_TRACKING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: PASS_TRACKING_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export const getPassDateKey = (value) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = dateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
};

export const formatPassTimestamp = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return timeFormatter.format(date);
};

export const isLongTermVisit = (record) => {
  const startDateKey = getPassDateKey(record?.actualInTime || record?.inTime);
  const finalOutDateKey = getPassDateKey(record?.outTime);

  return Boolean(startDateKey && finalOutDateKey && startDateKey < finalOutDateKey);
};

export const isPassTrackingDay = (record, value = new Date()) => {
  if (!isLongTermVisit(record)) return false;

  const currentDateKey = getPassDateKey(value);
  const finalOutDateKey = getPassDateKey(record?.outTime);

  return Boolean(currentDateKey && finalOutDateKey && currentDateKey < finalOutDateKey);
};

export const getDailyPassEvents = (record) => {
  return Array.isArray(record?.dailyPassEvents) ? record.dailyPassEvents : [];
};

export const hasPassEventForDate = (record, action, dateKey) => {
  return getDailyPassEvents(record).some(
    (event) => event?.action === action && event?.dateKey === dateKey
  );
};

export const getLatestPassEvent = (record) => {
  const events = getDailyPassEvents(record);
  if (events.length === 0) return null;
  return events[events.length - 1];
};

const createPassTrackingError = (message, code = "BAD_REQUEST") => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const buildPassEventDoc = ({ record, action, dateKey, recordedAt, recordedBy }) => ({
  action,
  dateKey,
  recordedAt,
  recordedBy,
  badgeNoAtEvent: record.cardNo || "",
});

export const addPassEventAtomic = async ({
  Model,
  recordId,
  action,
  recordedBy = "Security",
  recordedAt = new Date(),
}) => {
  if (!PASS_ACTIONS.has(action)) {
    throw createPassTrackingError("Invalid pass action.");
  }

  const existing = await Model.findById(recordId);
  if (!existing) {
    throw createPassTrackingError("Record not found", "NOT_FOUND");
  }

  if (!isPassTrackingDay(existing, recordedAt)) {
    throw createPassTrackingError(
      "Daily pass tracking is available only before the final checkout day."
    );
  }

  const dateKey = getPassDateKey(recordedAt);
  const eventDoc = buildPassEventDoc({
    record: existing,
    action,
    dateKey,
    recordedAt,
    recordedBy,
  });

  if (action === "issued") {
    const updated = await Model.findOneAndUpdate(
      {
        _id: recordId,
        dailyPassEvents: {
          $not: { $elemMatch: { action: "issued", dateKey } },
        },
      },
      {
        $push: { dailyPassEvents: eventDoc },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (updated) {
      return {
        record: updated,
        alreadyRecorded: false,
        message: "Pass issue recorded successfully.",
      };
    }

    const latest = await Model.findById(recordId);
    if (latest && hasPassEventForDate(latest, "issued", dateKey)) {
      return {
        record: latest,
        alreadyRecorded: true,
        message: "Pass has already been issued for this day.",
      };
    }

    throw createPassTrackingError("Unable to record pass issue. Please retry.");
  }

  if (!hasPassEventForDate(existing, "issued", dateKey)) {
    throw createPassTrackingError("Record pass issue before marking it returned.");
  }

  const updated = await Model.findOneAndUpdate(
    {
      _id: recordId,
      $and: [
        {
          dailyPassEvents: {
            $elemMatch: { action: "issued", dateKey },
          },
        },
        {
          dailyPassEvents: {
            $not: { $elemMatch: { action: "returned", dateKey } },
          },
        },
      ],
    },
    {
      $push: { dailyPassEvents: eventDoc },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (updated) {
    return {
      record: updated,
      alreadyRecorded: false,
      message: "Pass return recorded successfully.",
    };
  }

  const latest = await Model.findById(recordId);
  if (latest && hasPassEventForDate(latest, "returned", dateKey)) {
    return {
      record: latest,
      alreadyRecorded: true,
      message: "Pass has already been returned for this day.",
    };
  }

  if (latest && !hasPassEventForDate(latest, "issued", dateKey)) {
    throw createPassTrackingError("Record pass issue before marking it returned.");
  }

  throw createPassTrackingError("Unable to record pass return. Please retry.");
};

export const appendPassEvent = (record, { action, recordedAt = new Date(), recordedBy = "Security" }) => {
  if (!["issued", "returned"].includes(action)) {
    throw new Error("Invalid pass action.");
  }

  if (!isPassTrackingDay(record, recordedAt)) {
    throw new Error("Daily pass tracking is available only before the final checkout day.");
  }

  const dateKey = getPassDateKey(recordedAt);

  if (action === "issued" && hasPassEventForDate(record, "issued", dateKey)) {
    throw new Error("Pass has already been issued for this day.");
  }

  if (action === "returned") {
    if (!hasPassEventForDate(record, "issued", dateKey)) {
      throw new Error("Record pass issue before marking it returned.");
    }

    if (hasPassEventForDate(record, "returned", dateKey)) {
      throw new Error("Pass has already been returned for this day.");
    }
  }

  if (!Array.isArray(record.dailyPassEvents)) {
    record.dailyPassEvents = [];
  }

  record.dailyPassEvents.push({
    action,
    dateKey,
    recordedAt,
    recordedBy,
    badgeNoAtEvent: record.cardNo || "",
  });
};

export const ensureInitialPassIssued = (record, recordedBy = "Security") => {
  if (!isLongTermVisit(record)) return;

  const recordedAt = record.actualInTime || record.inTime;
  const dateKey = getPassDateKey(recordedAt);
  if (!dateKey || hasPassEventForDate(record, "issued", dateKey)) return;

  if (!Array.isArray(record.dailyPassEvents)) {
    record.dailyPassEvents = [];
  }

  record.dailyPassEvents.push({
    action: "issued",
    dateKey,
    recordedAt: recordedAt instanceof Date ? recordedAt : new Date(recordedAt),
    recordedBy,
    badgeNoAtEvent: record.cardNo || "",
  });
};

export const hasIssuedWithoutReturnForDate = (record, dateKey) => {
  return hasPassEventForDate(record, "issued", dateKey) && !hasPassEventForDate(record, "returned", dateKey);
};

export const hasPassReturnAlertForDate = (record, dateKey) => {
  return Array.isArray(record?.dailyPassAlertDates) && record.dailyPassAlertDates.includes(dateKey);
};

export const markPassReturnAlertSent = (record, dateKey) => {
  if (!dateKey) return;
  if (!Array.isArray(record.dailyPassAlertDates)) {
    record.dailyPassAlertDates = [];
  }
  if (!record.dailyPassAlertDates.includes(dateKey)) {
    record.dailyPassAlertDates.push(dateKey);
  }
};