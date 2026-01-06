import http from 'http';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import cron from 'node-cron';

import { buildApp, sessionMiddleware } from './app.js';
import { sequelize, Admin } from './models/index.js';
import { setSetting } from './services/settings.js';
import { startWhatsApp } from './services/whatsapp/bot.js';
import { attachWebSocketServer } from './services/realtime/ws.js';
import { pollDeposits } from './jobs/pollDeposits.js';
import { cleanupOld } from './jobs/cleanup.js';
import { normalizeIDPhoneToE16462 } from './utils/phone.js';

dotenv.config();

async function seed(){
  await sequelize.sync({ alter:true });

  const user = process.env.SEED_ADMIN_USER || 'admin';
  const pass = process.env.SEED_ADMIN_PASS || 'admin12345';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@local';
  const waRaw = process.env.SEED_ADMIN_WA || '081234567890';

  let admin = await Admin.findOne({ where:{ username:user } });
  if (!admin){
    admin = await Admin.create({
      username:user,
      email,
      password_hash: await bcrypt.hash(pass, 10),
      whatsapp_raw: waRaw,
      whatsapp_e164: normalizeIDPhoneToE16462(waRaw),
      is_primary:true
    });
  }

  await setSetting('allowed_admin_id', String(admin.id));
  await setSetting('admin_wa_e164', normalizeIDPhoneToE16462(waRaw));

  // default admin path
  await setSetting('admin_path', 'superadmin');

  console.log('Seed done. Admin:', user);
}

async function main(){
  if (process.argv.includes('--seed')) await seed();
  else await sequelize.sync({ alter:true });

  const app = await buildApp();
  const server = http.createServer(app);

  attachWebSocketServer({
    server,
    sessionMiddleware,
    sessionSecret: process.env.SESSION_SECRET
  });

  // start WA bot
  startWhatsApp().catch(()=>{});

  // cron jobs
  const pollSec = Number(process.env.POLL_DEPOSIT_SEC || 15);
  cron.schedule(`*/${pollSec} * * * * *`, pollDeposits);
  cron.schedule('0 3 * * *', ()=> cleanupOld(Number(process.env.CLEANUP_DAYS||60)));

  const port = Number(process.env.PORT || 3000);
  server.listen(port, ()=> console.log(`http://localhost:${port}`));
}
main();
