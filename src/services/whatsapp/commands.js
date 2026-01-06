import { Order } from '../../models/index.js';
import { notifyUserDone, notifyUserProcessing, notifyUserRejected } from './notifier.js';
import { bus, EVT } from '../realtime/bus.js';
import { logger } from '../realtime/logger.js';

export async function handleAdminCommand({ sock, text }){
  const t = String(text||'').trim();
  // format: done ORDERID note...
  //         reject ORDERID note...
  //         process ORDERID note...
  const [cmd, orderId, ...rest] = t.split(/\s+/);
  const note = rest.join(' ').trim();

  const c = String(cmd||'').toLowerCase();
  if (!['done','reject','rejected','process','processing'].includes(c)) return;

  const order = await Order.findOne({ where:{ order_id: orderId } });
  if (!order) return;

  if (c.startsWith('process')){
    order.fulfill_status='processing';
    if (note) order.admin_note = note;
    await order.save();
    await notifyUserProcessing(order);
    logger.info('wa cmd processing', { order_id: order.order_id });
  }

  if (c==='done'){
    order.fulfill_status='done';
    if (note) order.admin_note = note;
    await order.save();
    await notifyUserDone(order);
    logger.info('wa cmd done', { order_id: order.order_id });
  }

  if (c.startsWith('reject')){
    order.fulfill_status='rejected';
    if (note) order.admin_note = note;
    await order.save();
    await notifyUserRejected(order);
    logger.info('wa cmd rejected', { order_id: order.order_id });
  }

  bus.emit(EVT.ORDER_UPDATED,{ order_id:order.order_id, invoice_token:order.invoice_token });
  bus.emit(EVT.DASHBOARD_UPDATED,{});
}
