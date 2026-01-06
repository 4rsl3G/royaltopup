import { sendWA } from './bot.js';
import { tpl } from './templates.js';

export async function notifyUserPaid(order){
  if (!order.whatsapp_e164) return;
  await sendWA(order.whatsapp_e164, tpl.paid({
    order_id:order.order_id,
    product:order.product_name || 'Royal Dreams',
    qty:order.qty,
    total:order.gross_amount
  }));
}

export async function notifyUserProcessing(order){
  if (!order.whatsapp_e164) return;
  await sendWA(order.whatsapp_e164, tpl.processing({ order_id:order.order_id }));
}

export async function notifyUserDone(order){
  if (!order.whatsapp_e164) return;
  await sendWA(order.whatsapp_e164, tpl.done({ order_id:order.order_id, note:order.admin_note }));
}

export async function notifyUserRejected(order){
  if (!order.whatsapp_e164) return;
  await sendWA(order.whatsapp_e164, tpl.rejected({ order_id:order.order_id, note:order.admin_note }));
}
