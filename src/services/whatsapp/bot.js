import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import { normalizeIDPhoneToE16462, normalizeE164ToWAJid } from '../../utils/phone.js';
import { logger } from '../realtime/logger.js';
import { bus, EVT } from '../realtime/bus.js';
import { handleAdminCommand } from './commands.js';
import { getSetting } from '../settings.js';

let sock = null;
let waStatus = 'disconnected';
let lastQr = null;

export async function startWhatsApp(){
  const { state, saveCreds } = await useMultiFileAuthState('./wa_auth');

  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u)=>{
    const { connection, lastDisconnect, qr } = u;
    if (qr) lastQr = qr;

    if (connection === 'open'){
      waStatus = 'connected';
      lastQr = null;
    } else if (connection === 'close'){
      waStatus = 'disconnected';
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      if (shouldReconnect) startWhatsApp();
    } else {
      waStatus = connection || 'connecting';
    }

    logger.info('wa connection update', { status: waStatus, hasQr: !!lastQr });
    bus.emit(EVT.WA_UPDATED, { status: waStatus, qr: lastQr ? `data:image/png;base64,${Buffer.from(lastQr).toString('base64')}` : null });
  });

  sock.ev.on('messages.upsert', async ({ messages })=>{
    const msg = messages?.[0];
    if (!msg?.message) return;

    // admin only commands
    const adminWa = await getSetting('admin_wa_e164', null);
    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    // normalize sender
    const sender = from?.split('@')[0] || '';
    const senderE164 = normalizeIDPhoneToE16462(sender);

    if (adminWa && senderE164 === adminWa){
      await handleAdminCommand({ sock, text });
    }
  });

  return sock;
}

export function getWAState(){
  return { status: waStatus, qr: lastQr };
}

export async function sendWA(toRaw, text){
  if (!sock) { logger.warn('sendWA: no socket', { toRaw }); return false; }
  const e164 = normalizeIDPhoneToE16462(toRaw);
  if (!e164.startsWith('62')) return false;
  const jid = normalizeE164ToWAJid(e164);
  await sock.sendMessage(jid, { text:String(text||'') });
  logger.debug('sendWA sent', { to:e164, len:String(text||'').length });
  return true;
}
