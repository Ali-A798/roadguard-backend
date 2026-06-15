require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ✅ Health check — to verify server is running
app.get('/', (req, res) => {
  res.send('RoadGuard Backend is running! 🛡️');
});

// ✅ Main alert endpoint — called by ESP32 or frontend
app.post('/alert', async (req, res) => {
  const { name, latitude, longitude, contacts } = req.body;

  // Validate incoming data
  if (!name || !latitude || !longitude || !contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Build Google Maps link
  const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;

  // Build SMS message
  const message = 
`🚨 ACCIDENT ALERT - RoadGuard

${name} may have been in an accident.
Time: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}

📍 Last Known Location:
${mapsLink}

Please respond immediately or call emergency services.
— RoadGuard Safety System`;

  try {
    // Send SMS to all emergency contacts
    const results = [];
    for (const number of contacts) {
      const sms = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: number
      });
      results.push({ number, status: sms.status });
      console.log(`✅ SMS sent to ${number} — Status: ${sms.status}`);
    }

    res.status(200).json({
      success: true,
      message: `Alert sent to ${contacts.length} contact(s).`,
      results
    });

  } catch (error) {
    console.error('❌ Twilio Error:', error.message);
    res.status(500).json({ error: 'Failed to send alert.', details: error.message });
  }
});

// ✅ ESP32 dedicated endpoint — ESP32 sends signal here
// ESP32 doesn't store contacts, so frontend must have sent them to backend first
app.post('/esp32-trigger', async (req, res) => {
  const { force, deviceId } = req.body;

  console.log(`⚡ ESP32 Trigger received — Force: ${force}, Device: ${deviceId}`);

  // Acknowledge ESP32 immediately
  res.status(200).json({ received: true, force });

  // NOTE: Actual SMS sending happens via /alert endpoint
  // ESP32 trigger is logged — frontend polls or websocket can handle next step
});

// ✅ Test endpoint — to verify Twilio is configured correctly
app.get('/test-sms', async (req, res) => {
  try {
    const sms = await client.messages.create({
      body: '✅ RoadGuard backend is working correctly!',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.TEST_PHONE_NUMBER
    });
    res.json({ success: true, sid: sms.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛡️ RoadGuard Backend running on port ${PORT}`);
});
