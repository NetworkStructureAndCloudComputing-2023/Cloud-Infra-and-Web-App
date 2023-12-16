import Sequelize from 'sequelize'
import sequelize from '../models/sequel.js';
import User from './user.js'

const Documents = sequelize.define("documents", {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false, 
    primaryKey: true,
},
  name: {
    type: Sequelize.STRING,
  },
  createdBy: {
    type: Sequelize.STRING,
  },
  points: {
    type: Sequelize.INTEGER,
  },
  num_of_attemps: {
    type: Sequelize.INTEGER,
  },
  deadline: {
    type: Sequelize.DATE,
  },
}, {
  createdAt: 'assignment_created',
  updatedAt: 'assignment_updated', 
} );


export default Documents