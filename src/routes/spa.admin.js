import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { Admin, Order, Product, ProductPriceTier } from '../models/index.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { getSetting, setSetting, setSecret } from '../services/settings.js';
import { getProfile, bankList, cekRekening } from '../services/atlantic.js';
import { notifyUserDone, notifyUserProcessing, notifyUserRejected } from '../services/whatsapp/notifier.js';
import { sendWA } from '../services/whatsapp/bot.js';
import { tpl } from '../services/whatsapp/templates.js';
import { bus, EVT } from '../services/realtime/bus.js';
import { logger } from '../services/realtime/logger.js';
import { normalizeIDPhoneToE16462 } from '../utils/phone.js';

const router = express.Router();

async function renderPartial(res, name, data){
  return new Promise((resolve, reject)=>{
    res.render(name, data, (err, html)=> err ? reject(err) : resolve(html));
  });
}

// dynamic admin path from settings
router.use(async (req,res,next)=>{
  const adminPath = await getSetting('admin_path', 'superadmin');
  req.__adminPath = adminPath;
  next();
});

// shell entry
router.get('/:adminPath', async (req,res)=>{
  const real = req.__adminPath;
  if (req.params.adminPath !== real) return res.status(404).render('shell/public.shell',{title:'Not Found', bodyPartial:'public/notfound.partial', data:{} });

  const tab = req.query.tab || (req.session?.adminId ? 'dashboard' : 'login');

  // render shell only; content loaded via SPA
  return res.render('shell/admin.shell', {
    title:'Admin Panel',
    adminPath: real,
    tab
  });
});

// SPA partial endpoints
router.get('/:adminPath/p/login', async (req,res)=>{
  const real = req.__adminPath;
  if (req.params.adminPath !== real) return res.json({ ok:false });
  const html = await renderPartial(res,'admin/login.partial',{ adminPath: real });
  res.json({ ok:true, title:'Login', html });
});

router.get('/:adminPath/p/dashboard', requireAdmin, async (req,res)=>{
  const real = req.__adminPath;
  const stats = {
    totalOrders: await Order.count(),
    paidOrders: await Order.count({ where:{ pay_status:'paid' } }),
    waitingPaid: await Order.count({ where:{ pay_status:'paid', fulfill_status:'waiting' } }),
    processing: await Order.count({ where:{ fulfill_status:'processing' } }),
    doneOrders: await Order.count({ where:{ fulfill_status:'done' } }),
    rejected: await Order.count({ where:{ fulfill_status:'rejected' } })
  };
  const lastOrders = await Order.findAll({ order:[['created_at','DESC']], limit:20 });
  const html = await renderPartial(res,'admin/dashboard.partial',{ adminPath: real, stats, lastOrders });
  res.json({ ok:true, title:'Dashboard', html });
});

router.get('/:adminPath/p/orders', requireAdmin, async (req,res)=>{
  const real = req.__adminPath;
  const orders = await Order.findAll({ order:[['created_at','DESC']], limit:200 });
  const html = await renderPartial(res,'admin/orders.partial',{ adminPath: real, orders });
  res.json({ ok:true, title:'Orders', html });
});

router.get('/:adminPath/p/whatsapp', requireAdmin, async (req,res)=>{
  const real = req.__adminPath;
  const html = await renderPartial(res,'admin/whatsapp.partial',{ adminPath: real });
  res.json({ ok:true, title:'WhatsApp', html });
});

router.get('/:adminPath/p/logs', requireAdmin, async (req,res)=>{
  const real = req.__adminPath;
  const html = await renderPartial(res,'admin/logs.partial',{ adminPath: real });
  res.json({ ok:true, title:'Live Logs', html });
});

router.get('/:adminPath/p/products', requireAdmin, async (req,res)=>{
  const real = req.__adminPath;
  const products = await Product.findAll({ order:[['sort_order','ASC'],['id','ASC']] });
  const tiers = await ProductPriceTier.findAll({ order:[['price','ASC']] });
  const html = await renderPartial(res,'admin/products.partial',{ adminPath: real, products, tiers });
  res.json({ ok:true, title:'Products', html });
});

router.get('/:adminPath/p/settings', requireAdmin, async (req,res)=>{
  const real = req.__adminPath;
  const api_url = await getSetting('api_url','https://atlantich2h.com');
  const admin_wa = await getSetting('admin_wa_e164','');
  const html = await renderPartial(res,'admin/settings.partial',{ adminPath: real, api_url, admin_wa });
  res.json({ ok:true, title:'Settings', html });
});

// AUTH: login
router.post('/:adminPath/api/login', async (req,res)=>{
  const real = req.__adminPath;
  if (req.params.adminPath !== real) return res.json({ ok:false });

  const { username, password } = req.body;
  const allowed = await getSetting('allowed_admin_id', null);

  const admin = await Admin.findOne({ where:{ username:String(username||'') } });
  if (!admin) return res.json({ ok:false, message:'Login gagal' });

  if (allowed && String(admin.id) !== String(allowed)){
    return res.json({ ok:false, message:'Admin tidak diizinkan' });
  }

  const ok = await bcrypt.compare(String(password||''), admin.password_hash);
  if (!ok) return res.json({ ok:false, message:'Login gagal' });

  req.session.adminId = admin.id;
  admin.last_login_at = new Date();
  await admin.save();

  logger.info('admin login', { admin_id: admin.id });

  return res.json({ ok:true, toast:{ type:'success', message:'Login berhasil' }, redirect:`/${real}?tab=dashboard` });
});

// AUTH: logout
router.post('/:adminPath/api/logout', requireAdmin, async (req,res)=>{
  req.session.destroy(()=>{});
  res.json({ ok:true, redirect:`/${req.__adminPath}?tab=login` });
});

// OTP reset request (send to admin wa)
router.post('/:adminPath/api/reset/request', async (req,res)=>{
  const real = req.__adminPath;
  if (req.params.adminPath !== real) return res.json({ ok:false });

  const allowed = await getSetting('allowed_admin_id', null);
  const admin = await Admin.findByPk(Number(allowed));
  if (!admin) return res.json({ ok:false });

  const code = String(Math.floor(100000 + Math.random()*900000));
  await setSetting('reset_otp_code', code);
  await setSetting('reset_otp_exp', String(Date.now() + 5*60*1000));

  await sendWA(admin.whatsapp_e164, tpl.otp({ code }));
  logger.warn('otp issued', { admin_id: admin.id });

  res.json({ ok:true, toast:{ type:'info', message:'OTP dikirim ke WhatsApp admin.' } });
});

router.post('/:adminPath/api/reset/confirm', async (req,res)=>{
  const { otp, new_password } = req.body;
  const code = await getSetting('reset_otp_code', '');
  const exp = Number(await getSetting('reset_otp_exp', '0'));

  if (!otp || String(otp)!==String(code) || Date.now()>exp){
    return res.json({ ok:false, message:'OTP salah/expired' });
  }
  if (!new_password || String(new_password).length < 8){
    return res.json({ ok:false, message:'Password minimal 8 karakter' });
  }

  const allowed = await getSetting('allowed_admin_id', null);
  const admin = await Admin.findByPk(Number(allowed));
  admin.password_hash = await bcrypt.hash(String(new_password), 10);
  await admin.save();

  await setSetting('reset_otp_code','');
  await setSetting('reset_otp_exp','0');

  logger.warn('otp reset success', { admin_id: admin.id });
  res.json({ ok:true, toast:{ type:'success', message:'Password berhasil direset.' } });
});

// ADMIN: update order status
router.post('/:adminPath/api/order/:orderId/status', requireAdmin, async (req,res)=>{
  const { action, note } = req.body;
  const order = await Order.findOne({ where:{ order_id:req.params.orderId } });
  if (!order) return res.json({ ok:false, message:'Order tidak ditemukan' });

  const a = String(action||'').toLowerCase();
  if (!['processing','done','rejected'].includes(a)) return res.json({ ok:false, message:'Action invalid' });

  order.fulfill_status = a;
  if (note) order.admin_note = String(note);
  order.confirmed_by = req.session.adminId;
  order.confirmed_at = new Date();
  await order.save();

  if (a==='processing') await notifyUserProcessing(order);
  if (a==='done') await notifyUserDone(order);
  if (a==='rejected') await notifyUserRejected(order);

  logger.info('admin updated order', { order_id: order.order_id, action:a });

  bus.emit(EVT.ORDER_UPDATED,{ order_id:order.order_id, invoice_token:order.invoice_token });
  bus.emit(EVT.DASHBOARD_UPDATED,{});

  res.json({ ok:true, toast:{ type:'success', message:'Order updated' } });
});

// SETTINGS: save api_url, api_key, admin wa, admin path
router.post('/:adminPath/api/settings/save', requireAdmin, async (req,res)=>{
  const { api_url, api_key, admin_wa, admin_path } = req.body;

  if (api_url) await setSetting('api_url', String(api_url).trim());
  if (api_key) await setSecret('api_key_enc', String(api_key).trim());
  if (admin_wa){
    const e164 = normalizeIDPhoneToE16462(admin_wa);
    await setSetting('admin_wa_e164', e164);
  }
  if (admin_path){
    // allow change admin path
    await setSetting('admin_path', String(admin_path).trim().replace(/[^\w-]/g,''));
  }

  // test connection if asked
  try{ await getProfile(); } catch(e){ /* ignore */ }

  logger.info('settings saved', {});
  res.json({ ok:true, toast:{ type:'success', message:'Settings saved' } });
});

// BANK lookup
router.post('/:adminPath/api/bank/check', requireAdmin, async (req,res)=>{
  const { bank_code, account_number } = req.body;
  const r = await cekRekening({ bank_code, account_number });
  res.json({ ok:true, data:r });
});

router.post('/:adminPath/api/bank/list', requireAdmin, async (req,res)=>{
  const r = await bankList();
  res.json({ ok:true, data:r });
});

export default router;
