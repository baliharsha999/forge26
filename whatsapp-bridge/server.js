/**
 * Nagarik AI - Live WhatsApp Business Bridge
 * Turns phone number +91 9553948740 into the official Nagarik AI Chatbot!
 * 
 * - Pairs with phone via WhatsApp Linked Devices (Pairing Code or QR Code)
 * - Auto-responds to all inbound citizen WhatsApp messages using STAIR RAG Engine (port 8000)
 * - Exposes HTTP API on port 3001 for outbound proactive messaging
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

const PORT = 3001;
const BOT_PHONE_NUMBER = '919553948740'; // Official Nagarik AI Business Number
const STAIR_BACKEND_URL = 'http://127.0.0.1:8000/api/v1/schemes/chat';

const app = express();
app.use(express.json());

let sock = null;
let currentQR = null;
let currentPairingCode = null;
let isConnected = false;
let botJid = null;

async function startWhatsAppBridge() {
  const authDir = path.join(__dirname, 'auth_info_baileys');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Nagarik AI', 'Chrome', '1.0.0']
  });

  // Handle pairing code if not registered yet
  if (!sock.authState.creds.registered) {
    console.log(`[WhatsApp] Requesting Pairing Code for +${BOT_PHONE_NUMBER}...`);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(BOT_PHONE_NUMBER);
        currentPairingCode = code;
        console.log(`\n======================================================`);
        console.log(`🔔 WHATSAPP PAIRING CODE FOR +${BOT_PHONE_NUMBER}:`);
        console.log(`👉  ${code}  👈`);
        console.log(`Open WhatsApp on ${BOT_PHONE_NUMBER} -> Linked Devices -> Link with Phone Number -> Enter this code!`);
        console.log(`======================================================\n`);
      } catch (err) {
        console.error('[WhatsApp] Pairing code error:', err.message);
      }
    }, 4000);
  }

  // Connection Updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] Connection closed. Reconnecting: ${shouldReconnect}`);
      isConnected = false;
      currentPairingCode = null;
      if (shouldReconnect) {
        setTimeout(startWhatsAppBridge, 3000);
      }
    } else if (connection === 'open') {
      console.log(`\n✅ [WhatsApp] Successfully connected as +${BOT_PHONE_NUMBER}!`);
      isConnected = true;
      currentQR = null;
      currentPairingCode = null;
      botJid = sock.user.id;
    }
  });

  // Save Credentials
  sock.ev.on('creds.update', saveCreds);

  // Inbound Messages Listener
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;

      const fromJid = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;

      // Extract text content
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text || text.trim().length === 0) continue;

      // Don't respond to own automated messages, but allow "Message Yourself" testing
      if (isFromMe && fromJid !== botJid && !fromJid.includes(BOT_PHONE_NUMBER)) {
        continue;
      }

      console.log(`[WhatsApp] Inbound from ${fromJid}: "${text}"`);

      try {
        // Send typing indicator
        await sock.sendPresenceUpdate('composing', fromJid);

        // Query Nagarik AI STAIR Engine
        const res = await axios.post(
          STAIR_BACKEND_URL,
          { message: text, language: 'auto' },
          { timeout: 15000 }
        );

        const data = res.data;
        const answer = data.answer || 'Apologies, could not process request right now.';
        const citations = data.citations || [];

        // Format clean WhatsApp response
        let reply = answer;
        if (citations && citations.length > 0) {
          reply += '\n\n🏛️ *Official Verified Portals:*';
          citations.slice(0, 3).forEach((c) => {
            reply += `\n• *${c.name}*: ${c.official_url}`;
          });
        }
        reply += '\n\n_Reply with a question anytime — Nagarik AI is available 24/7._';

        // Send reply
        await sock.sendMessage(fromJid, { text: reply }, { quoted: msg });
        console.log(`[WhatsApp] Replied to ${fromJid} with verified guidance.`);
      } catch (err) {
        console.error('[WhatsApp] Processing error:', err.message);
        await sock.sendMessage(fromJid, {
          text: 'Namaste! We are currently synchronizing official portal records. Please try again in a few moments.'
        });
      }
    }
  });
}

// -----------------------------------------------------------------------------
// HTTP Control & Outbound Endpoints
// -----------------------------------------------------------------------------

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    phone_number: BOT_PHONE_NUMBER,
    pairing_code: currentPairingCode,
    has_qr: Boolean(currentQR)
  });
});

// Pairing & QR Code Webpage
app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Nagarik AI WhatsApp Bot</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family: sans-serif; background: #0B0C1E; color: #E8E9F2; text-align: center; padding: 40px 20px;">
        <div style="background: #14172B; max-width: 480px; margin: 0 auto; padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="font-size: 54px;">✅</div>
          <h2 style="color: #25D366; margin-top: 10px;">WhatsApp Bot Active!</h2>
          <p style="color: #8F93B5; font-size: 15px;">Phone number <strong>+${BOT_PHONE_NUMBER}</strong> is officially connected as the Nagarik AI RAG Chatbot.</p>
          <p style="background: #1B2038; padding: 12px; border-radius: 8px; font-family: monospace; color: #25D366;">Status: CONNECTED & LISTENING</p>
          <p style="font-size: 13px; color: #64748B;">Any citizen sending a message to +${BOT_PHONE_NUMBER} will receive instant AI replies.</p>
        </div>
      </body>
      </html>
    `);
  }

  let qrImgTag = '';
  if (currentQR) {
    const qrDataUrl = await QRCode.toDataURL(currentQR);
    qrImgTag = `<img src="${qrDataUrl}" style="width: 250px; height: 250px; border-radius: 12px; margin: 20px 0;" />`;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Connect WhatsApp Bot (+91 9553948740)</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: sans-serif; background: #0B0C1E; color: #E8E9F2; text-align: center; padding: 40px 20px;">
      <div style="background: #14172B; max-width: 480px; margin: 0 auto; padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <h2 style="color: #25D366; margin-bottom: 8px;">Connect Nagarik AI WhatsApp Bot</h2>
        <p style="color: #8F93B5; font-size: 14px; margin-bottom: 24px;">Link phone number <strong>+${BOT_PHONE_NUMBER}</strong></p>
        
        ${
          currentPairingCode
            ? `
          <div style="background: #1B2038; padding: 20px; border-radius: 12px; border: 1px solid #25D366; margin: 20px 0;">
            <p style="font-size: 12px; color: #25D366; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin: 0 0 10px 0;">Instant Pairing Code</p>
            <div style="font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 4px; color: #FFFFFF;">${currentPairingCode}</div>
            <p style="font-size: 13px; color: #8F93B5; margin: 12px 0 0 0;">Open WhatsApp on <strong>${BOT_PHONE_NUMBER}</strong> &rarr; Linked Devices &rarr; Link with Phone Number &rarr; Enter code</p>
          </div>
          `
            : ''
        }

        ${qrImgTag ? `<p style="font-size: 13px; color: #8F93B5;">Or scan this QR Code using WhatsApp camera:</p>${qrImgTag}` : ''}
        
        <p style="font-size: 12px; color: #64748B; margin-top: 20px;">This page refreshes automatically...</p>
      </div>
      <script>
        setTimeout(() => location.reload(), 4000);
      </script>
    </body>
    </html>
  `);
});

// Outbound message sender (to message users from +91 9553948740)
app.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" or "message"' });
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp bot is not connected yet. Please link via /qr' });
  }

  try {
    let cleanNumber = to.replace(/[^0-9]/g, '');
    if (!cleanNumber.startsWith('91') && cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }
    const jid = `${cleanNumber}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] Outbound message sent to ${jid}`);
    return res.json({ success: true, to: jid });
  } catch (err) {
    console.error('[WhatsApp] Outbound error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[WhatsApp Bridge] HTTP Server running on http://localhost:${PORT}`);
  startWhatsAppBridge();
});
