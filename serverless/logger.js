import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.json()
);

const logger = winston.createLogger({
 //lowest level
  level: 'info',
  format: logFormat,
  transports: [
    // Console transport for all levels
    new winston.transports.Console({
      level: 'info', // will include error, warn, and info
      format: winston.format.printf(
        ({ level, message, timestamp }) => JSON.stringify({ level, message, timestamp })
      )
    }),
    new winston.transports.File({ filename: 'myapp.log' }),
  ]
});


export default logger;
