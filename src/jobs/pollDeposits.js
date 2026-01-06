import { Deposit, Order } from '../models/index.js';
import { depositStatus } from '../services/atlantic.js';
import { notifyUserPaid } from '../services/whatsapp/notifier.js';
import { bus, EVT } from '../services/realtime/bus.js';
import { logger } from '../services/realtime/logger.js';

function mapStatus(resp){
  const s = resp?.data?.status ?? resp?.status ?? resp?.data?.data?.status ?? null;
  return s ? String(s).toLowerCase() : null;
}

export async function pollDeposits(){
  const deps = await Deposit.findAll({ where:{ status:'waiting' }, limit: 30, order:[['id','ASC']] });
  logger.debug('pollDeposits tick', { count: deps.length });

  for (const d of deps){
    if (!d.deposit_id) continue;
    try{
      const st = await depositStatus({ id: d.deposit_id });
      const s = mapStatus(st);
      if (!s) continue;

      const order = await Order.findByPk(d.order_pk);
      if (!order) continue;

      if (s === 'success' || s === 'paid'){
        d.status='success'; d.raw_response=st; await d.save();
        if (order.pay_status !== 'paid'){
          order.pay_status='paid'; order.paid_at=new Date(); await order.save();
          await notifyUserPaid(order);
          logger.info('deposit success', { deposit_id:d.deposit_id, order_id:order.order_id });
        }
        bus.emit(EVT.ORDER_UPDATED,{ order_id:order.order_id, invoice_token:order.invoice_token });
        bus.emit(EVT.DASHBOARD_UPDATED,{});
        continue;
      }

      if (s === 'expired' || s === 'expire'){
        d.status='expired'; d.raw_response=st; await d.save();
        if (order.pay_status === 'pending'){
          order.pay_status='expired'; await order.save();
        }
        logger.warn('deposit expired', { deposit_id:d.deposit_id, order_id:order.order_id });
        bus.emit(EVT.ORDER_UPDATED,{ order_id:order.order_id, invoice_token:order.invoice_token });
        bus.emit(EVT.DASHBOARD_UPDATED,{});
        continue;
      }

      if (['failed','canceled','cancelled'].includes(s)){
        d.status = s.includes('cancel') ? 'canceled' : 'failed';
        d.raw_response=st; await d.save();
        if (order.pay_status === 'pending'){
          order.pay_status = d.status; await order.save();
        }
        logger.warn('deposit failed/canceled', { deposit_id:d.deposit_id, order_id:order.order_id, mapped:d.status });
        bus.emit(EVT.ORDER_UPDATED,{ order_id:order.order_id, invoice_token:order.invoice_token });
        bus.emit(EVT.DASHBOARD_UPDATED,{});
      }
    }catch(e){
      logger.error('pollDeposits error', { deposit_id:d.deposit_id, err:String(e?.message||e) });
    }
  }
}
