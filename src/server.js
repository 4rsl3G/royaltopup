import http from 'http';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import cron from 'node-cron';

import { buildApp, sessionMiddleware } from './app.js';
import { sequelize, Admin, Product, ProductPriceTier } from './models/index.js';
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

    // seed product + tiers
  let prod = await Product.findOne({ where:{ sku:'RD-CHIPS' } });
  if (!prod){
    prod = await Product.create({ sku:'RD-CHIPS', name:'Royal Dreams Chips', sort_order:1, active:true });
  }

  const tiers = [
    ['120M', 1, 10000],
    ['250M', 1, 20000],
    ['350M', 1, 25000],
    ['400M', 1, 30000],
    ['500M', 1, 32500],
    ['530M', 1, 35000],
    ['750M', 1, 50000],
    ['1B',   1, 65000],
    ['1,53B',1, 100000],
    ['2B',   2, 130000],
    ['3B',   3, 195000],
    ['4B',   4, 260000],
    ['5B',   5, 325000],
    ['10B',  10, 645000],
    ['20B',  20, 1280000],
    ['50B',  50, 3150000]
  ];

  for (const [label, qty, price] of tiers){
    const exist = await ProductPriceTier.findOne({ where:{ product_id: prod.id, label } });
    if (!exist){
      await ProductPriceTier.create({ product_id: prod.id, label, qty, price });
    }
  }
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
