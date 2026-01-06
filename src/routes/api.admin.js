import express from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { Product, ProductPriceTier, Order } from '../models/index.js';
import { logger } from '../services/realtime/logger.js';
import { bus, EVT } from '../services/realtime/bus.js';

const router = express.Router();

router.use(async (req,res,next)=>{
  // attach adminPath from parent spa.admin middleware (if needed)
  next();
});

// PRODUCTS CRUD
router.post('/:adminPath/api/products/create', requireAdmin, async (req,res)=>{
  const { sku, name, image, sort_order, active } = req.body;
  if (!sku || !name) return res.json({ ok:false, message:'SKU & Name wajib' });

  const p = await Product.create({
    sku:String(sku).trim(),
    name:String(name).trim(),
    image: image ? String(image).trim() : null,
    sort_order: Number(sort_order||0),
    active: String(active||'1') === '1'
  });

  logger.info('product created', { id:p.id, sku:p.sku });
  return res.json({ ok:true, toast:{ type:'success', message:'Produk dibuat' } });
});

router.post('/:adminPath/api/products/update', requireAdmin, async (req,res)=>{
  const { id, sku, name, image, sort_order, active } = req.body;
  const p = await Product.findByPk(Number(id));
  if (!p) return res.json({ ok:false, message:'Produk tidak ditemukan' });

  p.sku = String(sku||p.sku).trim();
  p.name = String(name||p.name).trim();
  p.image = image ? String(image).trim() : null;
  p.sort_order = Number(sort_order||p.sort_order||0);
  p.active = String(active||'1') === '1';
  await p.save();

  logger.info('product updated', { id:p.id });
  return res.json({ ok:true, toast:{ type:'success', message:'Produk diupdate' } });
});

router.post('/:adminPath/api/products/delete', requireAdmin, async (req,res)=>{
  const { id } = req.body;
  const p = await Product.findByPk(Number(id));
  if (!p) return res.json({ ok:false, message:'Produk tidak ditemukan' });

  // block delete if orders exist
  const cnt = await Order.count({ where:{ product_id:p.id } });
  if (cnt > 0) return res.json({ ok:false, message:'Tidak bisa delete: ada order' });

  await ProductPriceTier.destroy({ where:{ product_id:p.id } });
  await p.destroy();

  logger.warn('product deleted', { id:Number(id) });
  return res.json({ ok:true, toast:{ type:'success', message:'Produk dihapus' } });
});

// TIERS CRUD
router.post('/:adminPath/api/tiers/create', requireAdmin, async (req,res)=>{
  const { product_id, label, qty, price } = req.body;
  if (!product_id || !label || !qty || !price) return res.json({ ok:false, message:'Data tier wajib lengkap' });

  await ProductPriceTier.create({
    product_id:Number(product_id),
    label:String(label).trim(),
    qty:Number(qty),
    price:Number(price)
  });

  logger.info('tier created', { product_id:Number(product_id) });
  return res.json({ ok:true, toast:{ type:'success', message:'Tier ditambah' } });
});

router.post('/:adminPath/api/tiers/delete', requireAdmin, async (req,res)=>{
  const { id } = req.body;
  const t = await ProductPriceTier.findByPk(Number(id));
  if (!t) return res.json({ ok:false, message:'Tier tidak ditemukan' });
  await t.destroy();

  logger.warn('tier deleted', { id:Number(id) });
  return res.json({ ok:true, toast:{ type:'success', message:'Tier dihapus' } });
});

// ORDERS list/detail JSON (opsional helper)
router.get('/:adminPath/api/orders/json', requireAdmin, async (req,res)=>{
  const orders = await Order.findAll({ order:[['created_at','DESC']], limit:300 });
  res.json({ ok:true, data:orders });
});

// Emit dashboard refresh hook endpoint (optional)
router.post('/:adminPath/api/realtime/ping', requireAdmin, async (req,res)=>{
  bus.emit(EVT.DASHBOARD_UPDATED,{});
  res.json({ ok:true });
});

export default router;
