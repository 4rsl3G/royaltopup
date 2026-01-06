import { sequelize } from '../config/db.js';

import Admin from './Admin.js';
import Setting from './Setting.js';
import Product from './Product.js';
import ProductPriceTier from './ProductPriceTier.js';
import Order from './Order.js';
import Deposit from './Deposit.js';
import Withdraw from './Withdraw.js';
import AuditLog from './AuditLog.js';

Admin.initModel(sequelize);
Setting.initModel(sequelize);
Product.initModel(sequelize);
ProductPriceTier.initModel(sequelize);
Order.initModel(sequelize);
Deposit.initModel(sequelize);
Withdraw.initModel(sequelize);
AuditLog.initModel(sequelize);

// relations
Product.hasMany(ProductPriceTier, { foreignKey:'product_id' });
ProductPriceTier.belongsTo(Product, { foreignKey:'product_id' });

Product.hasMany(Order, { foreignKey:'product_id' });
Order.belongsTo(Product, { foreignKey:'product_id' });

Order.hasMany(Deposit, { foreignKey:'order_pk' });
Deposit.belongsTo(Order, { foreignKey:'order_pk' });

Admin.hasMany(AuditLog, { foreignKey:'admin_id' });
AuditLog.belongsTo(Admin, { foreignKey:'admin_id' });

export {
  sequelize,
  Admin,
  Setting,
  Product,
  ProductPriceTier,
  Order,
  Deposit,
  Withdraw,
  AuditLog
};
