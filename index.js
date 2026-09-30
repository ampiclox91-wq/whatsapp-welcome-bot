const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nScan this QR code with WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Welcome Bot is online!");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("Connection closed.");

      if (shouldReconnect) {
        console.log("Reconnecting...");
        startBot();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];

    if (!message.message || message.key.fromMe) return;

    const sender = message.key.remoteJid;

    // Get the person's WhatsApp name when available
    const name =
      message.pushName ||
      "there";

    const welcomeMessage =
      `👋 Hello ${name}!\n\n` +
      `Welcome! 🎉\n` +
      `Thanks for connecting with us.\n\n` +
      `Stay tuned for updates, tips and announcements. 🚀`;

    await sock.sendMessage(sender, {
      text: welcomeMessage
    });

    console.log(`Welcome message sent to ${name}`);
  });
}

startBot();
