// Deposit.js
import { DataTypes, Model } from 'sequelize';

export default class Deposit extends Model {
  static initModel(sequelize){
    Deposit.init({
      id:{ type:DataTypes.BIGINT.UNSIGNED, autoIncrement:true, primaryKey:true },
      order_pk:{ type:DataTypes.BIGINT.UNSIGNED, allowNull:false },
      deposit_id:{ type:DataTypes.STRING(80), allowNull:true },  // provider tx id
      reff_id:{ type:DataTypes.STRING(80), allowNull:false, unique:true },
      nominal:{ type:DataTypes.BIGINT.UNSIGNED, allowNull:false, defaultValue:0 },
      type:{ type:DataTypes.STRING(40), allowNull:false, defaultValue:'ewallet' },
      metode:{ type:DataTypes.STRING(40), allowNull:false, defaultValue:'qris' },
      status:{ type:DataTypes.STRING(30), allowNull:false, defaultValue:'waiting' }, // waiting|success|expired|failed|canceled
      qr_string:{ type:DataTypes.TEXT('long'), allowNull:true },
      raw_response:{ type:DataTypes.JSON, allowNull:true },
      created_at:{ type:DataTypes.DATE, allowNull:false, defaultValue:DataTypes.NOW },
      updated_at:{ type:DataTypes.DATE, allowNull:true }
    },{
      sequelize,
      tableName:'deposits',
      underscored:true,
      timestamps:false
    });
  }
}
