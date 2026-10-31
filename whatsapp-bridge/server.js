/**
 * Nagarik AI - Live WhatsApp Business Bridge
 * Connects +91 9553948740 directly to Nagarik AI RAG Engine
 * 
 * - Pairs via QR Code or Phone Pairing Code
 * - Auto-routes all incoming WhatsApp messages to STAIR RAG Engine (port 8000)
 * - Auto-replies with verified government scheme citations (.gov.in)
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

const PORT = 3001;
const BOT_PHONE_NUMBER = '919553948740';
const STAIR_BACKEND_URL = 'http://127.0.0.1:8000/api/v1/schemes/chat';

const app = express();
app.use(express.json());

let sock = null;
let currentQR = null;
let currentPairingCode = null;
let isConnected = false;
let botJid = null;
let isStarting = false;

process.on('uncaughtException', (err) => {
  console.log('[WhatsApp Error Guard]', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.log('[WhatsApp Rejection Guard]', reason?.message || reason);
});

async function startWhatsAppBridge() {
  if (isStarting) return;
  isStarting = true;

  try {
    const authDir = path.join(__dirname, 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    if (sock) {
      try { sock.end(); } catch (_) {}
      sock = null;
    }

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Nagarik AI', 'Chrome', '1.0.0']
    });

    // Request pairing code if phone is not registered yet
    if (!sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          if (sock && !sock.authState.creds.registered && !isConnected) {
            console.log(`[WhatsApp] Requesting fresh pairing code for ${BOT_PHONE_NUMBER}...`);
            const code = await sock.requestPairingCode(BOT_PHONE_NUMBER);
            currentPairingCode = code;
            console.log(`\n======================================================`);
            console.log(`🔔 PAIRING CODE FOR +${BOT_PHONE_NUMBER}: 👉  ${code}  👈`);
            console.log(`1. In WhatsApp -> Linked Devices -> Link a Device`);
            console.log(`2. Tap "Link with phone number instead"`);
            console.log(`3. Country: India (+91) | Number: ONLY 10 digits: 9553948740`);
            console.log(`4. Enter code: ${code}`);
            console.log(`======================================================\n`);
          }
        } catch (err) {
          console.log('[WhatsApp] Pairing code note:', err.message);
        }
      }, 3500);
    }

    // Connection Updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        console.log('\n[WhatsApp] QR Code ready! Scan with camera at http://localhost:3001/qr\n');
        try {
          qrcodeTerminal.generate(qr, { small: true });
        } catch (_) {}
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Socket closed (${statusCode || 'unknown'}). Reconnecting in 3s...`);
        isConnected = false;
        currentPairingCode = null;

        if (isLoggedOut) {
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (_) {}
        }

        setTimeout(() => {
          isStarting = false;
          startWhatsAppBridge();
        }, 3000);
      } else if (connection === 'open') {
        console.log(`\n======================================================`);
        console.log(`✅ [WhatsApp] CONNECTED AS NAGARIK AI BOT (+${BOT_PHONE_NUMBER})!`);
        console.log(`======================================================\n`);
        isConnected = true;
        currentQR = null;
        currentPairingCode = null;
        botJid = sock.user.id;
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Inbound Messages Listener
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;

        const fromJid = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';

        if (!text || text.trim().length === 0) continue;

        // Skip self-replies unless self-chatting
        if (isFromMe && fromJid !== botJid && !fromJid.includes(BOT_PHONE_NUMBER)) {
          continue;
        }

        console.log(`\n[WhatsApp Inbound] From ${fromJid}: "${text}"`);

        try {
          // Send typing indicator
          await sock.sendPresenceUpdate('composing', fromJid);

          // Query STAIR RAG Engine
          const res = await axios.post(
            STAIR_BACKEND_URL,
            { message: text, language: 'auto' },
            { timeout: 20000 }
          );

          const data = res.data;
          const answer = data.answer || 'Apologies, could not process query right now.';
          const citations = data.citations || [];

          let reply = answer;
          if (citations && citations.length > 0) {
            reply += '\n\n🏛️ *Official Verified Portals:*';
            citations.slice(0, 3).forEach((c) => {
              reply += `\n• *${c.name}*: ${c.official_url}`;
            });
          }
          reply += '\n\n_Nagarik AI Civic Bot • 24/7 Verified Indian Citizen Assistant_';

          await sock.sendMessage(fromJid, { text: reply }, { quoted: msg });
          console.log(`[WhatsApp Outbound] Successfully replied to ${fromJid}`);
        } catch (err) {
          console.error('[WhatsApp Error]', err.message);
          try {
            await sock.sendMessage(fromJid, {
              text: 'Namaste! We are currently retrieving official records from state portals. Please try your question again in a moment.'
            });
          } catch (_) {}
        }
      }
    });
  } catch (err) {
    console.error('[WhatsApp Setup Error]', err.message);
    setTimeout(() => {
      isStarting = false;
      startWhatsAppBridge();
    }, 5000);
  } finally {
    isStarting = false;
  }
}

// -----------------------------------------------------------------------------
// Web Interface & HTTP APIs
// -----------------------------------------------------------------------------

app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    phone_number: BOT_PHONE_NUMBER,
    pairing_code: currentPairingCode,
    has_qr: Boolean(currentQR)
  });
});

app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nagarik AI WhatsApp Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0C1E; color: #E8E9F2; text-align: center; padding: 40px 20px; }
          .card { background: #14172B; max-width: 480px; margin: 0 auto; padding: 32px; border-radius: 20px; border: 1px solid rgba(37,211,102,0.3); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
          .badge { background: rgba(37,211,102,0.15); color: #25D366; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 13px; display: inline-block; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● LIVE & ACTIVE</div>
          <h2 style="color: #25D366; margin: 0 0 10px 0;">WhatsApp Bot Connected!</h2>
          <p style="color: #8F93B5; font-size: 15px;">Phone number <strong>+${BOT_PHONE_NUMBER}</strong> is officially serving citizens via Nagarik AI RAG.</p>
          <div style="background: #1B2038; padding: 14px; border-radius: 10px; font-family: monospace; color: #25D366; margin: 20px 0;">
            Status: LISTENING TO MESSAGES
          </div>
          <p style="font-size: 13px; color: #64748B;">Send any scheme or Aadhaar DBT question to this number to test live responses.</p>
        </div>
      </body>
      </html>
    `);
  }

  let qrImgTag = '';
  if (currentQR) {
    const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 300, margin: 2 });
    qrImgTag = `<img src="${qrDataUrl}" style="width: 260px; height: 260px; border-radius: 16px; margin: 15px auto; display: block; border: 4px solid #25D366;" />`;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect WhatsApp Bot (+91 9553948740)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0C1E; color: #E8E9F2; text-align: center; padding: 30px 16px; margin: 0; }
        .card { background: #14172B; max-width: 500px; margin: 0 auto; padding: 28px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
        .pill { background: rgba(37,211,102,0.15); color: #25D366; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 12px; }
        .code-box { background: #1B2038; padding: 16px; border-radius: 12px; border: 1px dashed #25D366; margin: 20px 0; }
        .code { font-size: 32px; font-family: ui-monospace, monospace; font-weight: 800; letter-spacing: 5px; color: #25D366; }
        ol { text-align: left; font-size: 13px; color: #8F93B5; line-height: 1.6; padding-left: 20px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="pill">NAGARIK AI • WHATSAPP BRIDGE</div>
        <h2 style="color: #FFFFFF; margin: 0 0 8px 0;">Connect WhatsApp Bot</h2>
        <p style="color: #8F93B5; font-size: 14px; margin: 0 0 20px 0;">Official Citizen Helpline for <strong>+${BOT_PHONE_NUMBER}</strong></p>

        <!-- Method 1: QR Scan -->
        <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px;">
          <h3 style="color: #25D366; font-size: 15px; margin: 0 0 8px 0;">Method 1: Scan with WhatsApp Camera (Easiest)</h3>
          <p style="color: #8F93B5; font-size: 12px; margin: 0;">Open WhatsApp on phone &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong> &rarr; Scan below:</p>
          ${qrImgTag || '<div style="padding: 40px 0; color: #8F93B5; font-size: 14px;">Generating fresh QR code...</div>'}
        </div>

        <!-- Method 2: Pairing Code -->
        ${
          currentPairingCode
            ? `
          <div class="code-box">
            <div style="font-size: 11px; color: #25D366; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Method 2: 8-Digit Pairing Code</div>
            <div class="code">${currentPairingCode}</div>
            <ol>
              <li>Open WhatsApp on <strong>${BOT_PHONE_NUMBER}</strong> &rarr; <strong>Linked Devices</strong></li>
              <li>Tap <strong>Link a Device</strong> &rarr; Tap <strong>"Link with phone number instead"</strong></li>
              <li>Country: <strong>India (+91)</strong> &bull; Number: type ONLY <strong>9553948740</strong></li>
              <li>Enter code <strong>${currentPairingCode}</strong></li>
            </ol>
          </div>
          `
            : ''
        }

        <p style="font-size: 11px; color: #64748B; margin-top: 20px;">Page auto-refreshes every 4 seconds...</p>
      </div>
      <script>
        setTimeout(() => location.reload(), 4000);
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`[WhatsApp Bridge] HTTP Server running on http://localhost:${PORT}`);
  startWhatsAppBridge();
});
