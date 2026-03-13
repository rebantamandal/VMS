import mongoose from "mongoose";

export let dbStatus = "Disconnected";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: "visitorDB",
    });

    dbStatus = "Connected";

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    dbStatus = "Connection Failed";
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};
