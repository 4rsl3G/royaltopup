import { Op } from 'sequelize';
import { Order, Deposit } from '../models/index.js';
import { logger } from '../services/realtime/logger.js';

export async function cleanupOld(days=60){
  const cut = new Date(Date.now() - days*24*60*60*1000);

  const depDel = await Deposit.destroy({ where:{ created_at:{ [Op.lt]: cut } } });
  // order: hapus hanya yang final & tua
  const ordDel = await Order.destroy({
    where:{
      created_at:{ [Op.lt]: cut },
      fulfill_status:{ [Op.in]: ['done','rejected'] }
    }
  });

  logger.info('cleanup done', { days, deposits_deleted: depDel, orders_deleted: ordDel });
}
