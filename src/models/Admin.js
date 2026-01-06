import { DataTypes, Model } from 'sequelize';

export default class Admin extends Model {
  static initModel(sequelize){
    Admin.init({
      id:{ type:DataTypes.INTEGER.UNSIGNED, autoIncrement:true, primaryKey:true },
      username:{ type:DataTypes.STRING(60), allowNull:false, unique:true },
      email:{ type:DataTypes.STRING(120), allowNull:false },
      password_hash:{ type:DataTypes.STRING(200), allowNull:false },
      whatsapp_raw:{ type:DataTypes.STRING(32), allowNull:false },
      whatsapp_e164:{ type:DataTypes.STRING(20), allowNull:false },
      is_primary:{ type:DataTypes.BOOLEAN, allowNull:false, defaultValue:false },
      last_login_at:{ type:DataTypes.DATE, allowNull:true }
    },{
      sequelize,
      tableName:'admins',
      underscored:true
    });
  }
}
