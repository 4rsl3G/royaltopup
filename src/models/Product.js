// Product.js
import { DataTypes, Model } from 'sequelize';

export default class Product extends Model {
  static initModel(sequelize){
    Product.init({
      id:{ type:DataTypes.INTEGER.UNSIGNED, autoIncrement:true, primaryKey:true },
      sku:{ type:DataTypes.STRING(64), allowNull:false, unique:true },
      name:{ type:DataTypes.STRING(180), allowNull:false },
      game_name:{ type:DataTypes.STRING(120), allowNull:false, defaultValue:'Royal Dreams' },
      image:{ type:DataTypes.STRING(255), allowNull:true },
      active:{ type:DataTypes.BOOLEAN, allowNull:false, defaultValue:true },
      sort_order:{ type:DataTypes.INTEGER, allowNull:false, defaultValue:0 }
    },{
      sequelize,
      tableName:'products',
      underscored:true
    });
  }
}
