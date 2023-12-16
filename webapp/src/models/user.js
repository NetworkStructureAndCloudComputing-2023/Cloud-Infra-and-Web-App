import Sequelize from 'sequelize'
import sequelize from '../models/sequel.js';
import bcrypt from 'bcrypt';

const Users = sequelize.define("users", {
  id:{
    type: Sequelize.DataTypes.UUID,
    defaultValue: Sequelize.DataTypes.UUIDV4,
    primaryKey: true
},
first_name:{
    type: Sequelize.STRING,
    required: true,
    allowNull: false
},
last_name:{
    type: Sequelize.STRING,
    required: true,
    allowNull: false
},
email:{
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
    validate: {
        isEmail: {
            args: true,
            msg: "give a valid email address!"
        }
    }
},
password:{
    type: Sequelize.STRING,
    required: true,
    validate:{
        len: {
            args : [5,500],
            msg: "Password should be between 5 and 15 characters"
        }
    }
},
account_created: {
    type: 'TIMESTAMP',
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    allowNull: false,
    
},
account_updated: {
    type: 'TIMESTAMP',
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    allowNull: false,
    
},
verified: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    validate: {
      notNull: true,
      notEmpty: true,
    },
  },
  
});

Users.beforeCreate(async (user)=>{
    if(user.password){
        const saltRounds = 10;
        user.password = await bcrypt.hash(user.password,saltRounds);
    }
})

export default Users