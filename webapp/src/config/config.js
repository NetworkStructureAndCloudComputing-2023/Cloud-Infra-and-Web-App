import dotenv from 'dotenv';
import csvtojson from 'csvtojson';
import mysql from 'mysql2'

dotenv.config()

const config = {
    HOST: process.env.HOST,
    USER: process.env.USER,
    PASSWORD: process.env.PASSWORD,
    DATABASE: process.env.DATABASE,
    dialect: "mariadb",
   
}


export default config

