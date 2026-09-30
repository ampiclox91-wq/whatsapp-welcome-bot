const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const express = require("express");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

let currentQR = null;
let botStatus = "Starting...";

app.get("/", async (req, res) => {
  if (currentQR) {
    const qrImage = await QRCode.toDataURL(currentQR);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Welcome Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 30px;
            background: #f5f5f5;
          }

          .box {
            background: white;
            max-width: 500px;
            margin: auto;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
          }

          img {
            width: 300px;
            max-width: 100%;
          }

          h1 {
            color: #222;
          }

          p {
            color: #555;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <h1>WhatsApp Welcome Bot</h1>
          <p>Scan this QR code with WhatsApp</p>
          <img src="${qrImage}">
          <p>WhatsApp → Linked Devices → Link a Device</p>
        </div>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
      <head>
        <meta http-equiv="refresh" content="5">
        <title>WhatsApp Welcome Bot</title>
      </head>
      <body style="font-family:Arial;text-align:center;padding:50px">
        <h1>WhatsApp Welcome Bot</h1>
        <h2>${botStatus}</h2>
        <p>Waiting for QR code...</p>
        <p>This page will refresh automatically.</p>
      </body>
      </html>
    `);
  }
});

app.get("/status", (req, res) => {
  res.json({
    bot: "WhatsApp Welcome Bot",
    status: botStatus
  });
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {

    if (qr) {
      currentQR = qr;
      botStatus = "Waiting for WhatsApp QR scan";

      console.log("New QR code generated.");
      console.log("Open your Railway service URL to scan it.");
    }

    if (connection === "open") {
      currentQR = null;
      botStatus = "Online";

      console.log("✅ WhatsApp Welcome Bot is online!");
    }

    if (connection === "close") {
      botStatus = "Disconnected";

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("Reconnecting...");
        setTimeout(startBot, 3000);
      } else {
        console.log("WhatsApp logged out. Please restart the service.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];

    if (!message.message || message.key.fromMe) return;

    const sender = message.key.remoteJid;
    const name = message.pushName || "there";

    const welcomeMessage =
      `👋 Hello ${name}!\n\n` +
      `Welcome! 🎉\n` +
      `Thanks for connecting with us.\n\n` +
      `Stay tuned for updates, tips and announcements. 🚀`;

    try {
      await sock.sendMessage(sender, {
        text: welcomeMessage
      });

      console.log(`Welcome message sent to ${name}`);
    } catch (error) {
      console.log("Could not send welcome message:", error.message);
    }
  });
}

startBot();
