import { DataTypes, Model } from 'sequelize';

export default class Setting extends Model {
  static initModel(sequelize){
    Setting.init({
      key:{ type:DataTypes.STRING(80), primaryKey:true },
      value:{ type:DataTypes.TEXT('long'), allowNull:true },
      updated_at:{ type:DataTypes.DATE, allowNull:true }
    },{
      sequelize,
      tableName:'settings',
      underscored:true,
      timestamps:false
    });
  }
}
