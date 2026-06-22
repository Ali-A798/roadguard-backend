require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Health check — to verify server is running
app.get("/", (req, res) => {
  res.send("RoadGuard Backend is running! 🛡️");
});

// ✅ Main alert endpoint — called by ESP32 or frontend
app.post("/alert", async (req, res) => {
  const { name, latitude, longitude, contacts } = req.body;

  // Validate incoming data
  if (!name || !latitude || !longitude || !contacts || contacts.length === 0) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // Build Google Maps link
  const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;

  // Build SMS message
  const message = `🚨 ACCIDENT ALERT - RoadGuard

${name} may have been in an accident.
Time: ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
📍 Last Known Location:
${mapsLink}

Please respond immediately or call emergency services.
— RoadGuard Safety System`;

  try {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
      },
    );

    console.log("✅ Telegram alert sent");

    res.status(200).json({
      success: true,
      message: "Telegram alert sent successfully.",
    });
  } catch (error) {
    console.error("❌ Telegram Error:", error.message);

    res.status(500).json({
      error: "Failed to send Telegram alert.",
      details: error.message,
    });
  }
});
// ✅ ESP32 dedicated endpoint — ESP32 sends signal here
// ESP32 doesn't store contacts, so frontend must have sent them to backend first
app.post("/esp32-trigger", async (req, res) => {
  const { force, deviceId } = req.body;

  console.log(
    `⚡ ESP32 Trigger received — Force: ${force}, Device: ${deviceId}`,
  );

  // Acknowledge ESP32 immediately
  res.status(200).json({ received: true, force });

  // NOTE: Actual SMS sending happens via /alert endpoint
  // ESP32 trigger is logged — frontend polls or websocket can handle next step
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛡️ RoadGuard Backend running on port ${PORT}`);
});
