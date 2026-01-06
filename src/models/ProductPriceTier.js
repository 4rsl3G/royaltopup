// ProductPriceTier.js
import { DataTypes, Model } from 'sequelize';

export default class ProductPriceTier extends Model {
  static initModel(sequelize){
    ProductPriceTier.init({
      id:{ type:DataTypes.INTEGER.UNSIGNED, autoIncrement:true, primaryKey:true },
      product_id:{ type:DataTypes.INTEGER.UNSIGNED, allowNull:false },
      label:{ type:DataTypes.STRING(60), allowNull:false },     // e.g. "1B"
      qty:{ type:DataTypes.INTEGER.UNSIGNED, allowNull:false }, // qty = "B units" or custom mapping
      price:{ type:DataTypes.BIGINT.UNSIGNED, allowNull:false } // rupiah
    },{
      sequelize,
      tableName:'product_price_tiers',
      underscored:true
    });
  }
}
