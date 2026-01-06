import { EventEmitter } from 'events';
export const bus = new EventEmitter();
bus.setMaxListeners(0);
export const EVT = {
  ORDER_UPDATED:'order.updated',
  DASHBOARD_UPDATED:'dashboard.updated',
  WA_UPDATED:'wa.updated',
  LOG:'log'
};
