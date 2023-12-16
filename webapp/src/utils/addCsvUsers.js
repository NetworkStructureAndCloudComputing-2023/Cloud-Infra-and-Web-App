import csv from 'csv-parser';
import fs from 'fs';
import dotenv from 'dotenv';
import Users from '../models/user.js';
import logger from './logger.js'
const results = [];

dotenv.config
const path= process.env.DEFAULTUSERPATH


function cleanString(input) {
  // Removing whitespaces
  return input.trim(); 
}

function refreshUserData() {
  results.length = 0; // Clear the existing data

  fs.createReadStream(path)
    .pipe(csv())
    //.on('data', (data) => results.push(data))
    .on('data', (rawData) => {
      // Process & clean data
      const cleanedData = {};
      for (const [key, value] of Object.entries(rawData)) {
        cleanedData[key] = cleanString(value);
      }
      results.push(cleanedData);
    })
    .on('end', () => {
      logger.info('User data refreshed:', results);
    });
}

// Call the function to refresh user data when the program starts
refreshUserData();

export default results
