const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const express = require("express");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

// Leave this empty for now.
// We will put your selected group ID here later.
const TARGET_GROUP_ID = "";

let currentQR = null;
let botStatus = "Starting...";
let sock = null;

app.get("/", async (req, res) => {
  if (currentQR) {
    const qrImage = await QRCode.toDataURL(currentQR);

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Group Welcome Bot</title>
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
          }

          img {
            width: 300px;
            max-width: 100%;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <h1>WhatsApp Group Welcome Bot</h1>
          <p>Scan this QR code with WhatsApp</p>

          <img src="${qrImage}">

          <p>
            WhatsApp → Linked Devices → Link a Device
          </p>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <html>
    <head>
      <meta http-equiv="refresh" content="5">
      <title>WhatsApp Group Welcome Bot</title>
    </head>

    <body style="font-family:Arial;text-align:center;padding:50px">

      <h1>WhatsApp Group Welcome Bot</h1>

      <h2>${botStatus}</h2>

      <p>
        ${
          TARGET_GROUP_ID
            ? "Target group has been configured."
            : "Target group has not been selected yet."
        }
      </p>

    </body>
    </html>
  `);
});

app.get("/groups", async (req, res) => {
  if (!sock) {
    return res.json({
      error: "WhatsApp is not connected yet."
    });
  }

  try {
    const groups = await sock.groupFetchAllParticipating();

    const list = Object.values(groups).map(group => ({
      name: group.subject,
      id: group.id
    }));

    res.json(list);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/status", (req, res) => {
  res.json({
    bot: "WhatsApp Group Welcome Bot",
    status: botStatus,
    targetGroup: TARGET_GROUP_ID || "Not selected"
  });
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({
    connection,
    lastDisconnect,
    qr
  }) => {

    if (qr) {
      currentQR = qr;
      botStatus = "Waiting for WhatsApp QR scan";

      console.log("New QR code generated.");
    }

    if (connection === "open") {

      currentQR = null;
      botStatus = "Online";

      console.log("✅ WhatsApp Group Welcome Bot is online!");
      console.log("Target Group:", TARGET_GROUP_ID || "Not selected");
    }

    if (connection === "close") {

      botStatus = "Disconnected";

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("Reconnecting...");
        setTimeout(startBot, 3000);
      }
    }
  });

  /*
   * Detect when someone is added to a group.
   */
  sock.ev.on("group-participants.update", async (update) => {

    console.log("Group participant update:", update);

    // Ignore groups other than your selected group
    if (
      TARGET_GROUP_ID &&
      update.id !== TARGET_GROUP_ID
    ) {
      return;
    }

    // Only continue when someone is added
    if (update.action !== "add") {
      return;
    }

    for (const participant of update.participants) {

      try {

        let name = participant.split("@")[0];

        /*
         * Try to get the person's WhatsApp contact name.
         */
        const contact = sock.store?.contacts?.[participant];

        if (contact?.name) {
          name = contact.name;
        } else if (contact?.notify) {
          name = contact.notify;
        }

        const welcomeMessage =
          `👋 Welcome to the group, ${name}!\n\n` +
          `We're happy to have you here. 🎉\n\n` +
          `Please feel free to introduce yourself ` +
          `and enjoy the community!`;

        await sock.sendMessage(update.id, {
          text: welcomeMessage,
          mentions: [participant]
        });

        console.log(
          `Welcome message sent to ${name}`
        );

      } catch (error) {

        console.log(
          "Could not send welcome message:",
          error.message
        );

      }
    }
  });
}

startBot();
