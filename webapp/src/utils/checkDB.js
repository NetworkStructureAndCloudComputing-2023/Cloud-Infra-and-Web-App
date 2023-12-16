import sequelize from '../models/sequel.js';
import logger from './logger.js';

async function checkDbConnection(req, res, next) {
  try {
    await sequelize.authenticate();
    next();
  } catch (error) {
    // Sequelize errors contain a 'name' property that you can use to determine the type of error
    if (error.name === 'SequelizeConnectionRefusedError' || error.original && error.original.code === 'ECONNREFUSED') {
      logger.error('Database connection was refused:', error);
      res.status(503).send('Service Unavailable');
    } else {
      // For all other types of errors, return a 500 Internal Server Error
      logger.error('Database connection error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}

export default checkDbConnection;

