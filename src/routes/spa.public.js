import express from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';

import { Product, ProductPriceTier, Order, Deposit } from '../models/index.js';
import { normalizeIDPhoneToE16462 } from '../utils/phone.js';
import { depositCreate } from '../services/atlantic.js';
import { logger } from '../services/realtime/logger.js';

const router = express.Router();

async function renderPartial(res, name, data){
  return new Promise((resolve, reject)=>{
    res.render(name, data, (err, html)=> err ? reject(err) : resolve(html));
  });
}

router.get('/', async (req,res)=>{
  const products = await Product.findAll({ where:{ active:true }, order:[['sort_order','ASC'],['id','ASC']] });
  return res.render('shell/public.shell', {
    title:'Royal Dreams Topup',
    bodyPartial:'public/landing.partial',
    data:{ products }
  });
});

// SPA partials
router.get('/p/order', async (req,res)=>{
  const products = await Product.findAll({ where:{ active:true }, order:[['sort_order','ASC'],['id','ASC']] });
  const tiers = await ProductPriceTier.findAll({ order:[['price','ASC']] });
  const html = await renderPartial(res,'public/order.partial',{ products, tiers });
  res.json({ ok:true, title:'Order', html });
});

router.get('/invoice/:token', async (req,res)=>{
  const order = await Order.findOne({ where:{ invoice_token:req.params.token } });
  if (!order) return res.status(404).render('shell/public.shell', { title:'Not Found', bodyPartial:'public/notfound.partial', data:{} });
  const dep = await Deposit.findOne({ where:{ order_pk:order.id }, order:[['id','DESC']] });

  let qrDataUrl=null;
  if (order.pay_status==='pending' && dep?.qr_string){
    try{ qrDataUrl = await QRCode.toDataURL(dep.qr_string); }catch{}
  }

  return res.render('shell/public.shell', {
    title:`Invoice ${order.order_id}`,
    bodyPartial:'public/invoice.partial',
    data:{ order, qrDataUrl }
  });
});

// API create order (public)
router.post('/api/public/order', async (req,res)=>{
  try{
    const { product_id, tier_id, game_id, nickname, whatsapp, email } = req.body;

    const product = await Product.findByPk(product_id);
    const tier = await ProductPriceTier.findByPk(tier_id);
    if (!product || !tier) return res.json({ ok:false, message:'Produk tidak valid' });

    const order_id = `RG-${Date.now()}-${Math.random().toString(16).slice(2,6).toUpperCase()}`;
    const invoice_token = crypto.randomBytes(20).toString('hex');

    const waE164 = normalizeIDPhoneToE16462(whatsapp);

    const order = await Order.create({
      order_id,
      invoice_token,
      product_id: product.id,
      product_name: product.name,
      game_id, nickname,
      whatsapp_raw: whatsapp,
      whatsapp_e164: waE164,
      email,
      tier_id: tier.id,
      qty: tier.qty,
      unit_price: tier.price,
      gross_amount: tier.price,
      pay_status:'pending',
      fulfill_status:'waiting'
    });

    // create deposit
    const reff_id = `dep_${order.order_id}`;
    const depResp = await depositCreate({ reff_id, nominal: order.gross_amount, type:'ewallet', metode:'qris' });

    // adapt response (provider-specific)
    const deposit_id = depResp?.data?.id || depResp?.data?.data?.id || depResp?.data?.trx_id || null;
    const qr_string = depResp?.data?.qr_string || depResp?.data?.data?.qr_string || depResp?.data?.qris || null;

    await Deposit.create({
      order_pk: order.id,
      deposit_id,
      reff_id,
      nominal: order.gross_amount,
      type:'ewallet',
      metode:'qris',
      status:'waiting',
      qr_string,
      raw_response: depResp
    });

    logger.info('order created', { order_id: order.order_id, gross: order.gross_amount });

    return res.json({
      ok:true,
      data:{ invoice_url:`/invoice/${order.invoice_token}` },
      toast:{ type:'success', message:'Order dibuat. Silakan bayar via QRIS.' }
    });
  } catch(e){
    logger.error('create order error', { err:String(e?.message||e) });
    return res.json({ ok:false, message:'Gagal membuat order' });
  }
});

export default router;
