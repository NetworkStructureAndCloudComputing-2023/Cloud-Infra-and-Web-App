import Sequelize from 'sequelize';
import sequelize from '../models/sequel.js';
import Documents from './document.js';

const Submission = sequelize.define('submissions', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  assignment_id: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: Documents,
      key: 'id',
    },
  },
  name: {
    type: Sequelize.STRING,
  },
  submission_url: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  submission_date: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  submission_updated: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
}, {
  createdAt: 'submission_created',
  updatedAt: 'submission_updated',
});

//creating foreign key relationship
Documents.hasMany(Submission, { foreignKey: 'assignment_id' });
Submission.belongsTo(Documents, { foreignKey: 'assignment_id' });

export default Submission;
