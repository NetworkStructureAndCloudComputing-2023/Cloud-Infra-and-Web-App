import mysql from 'mysql2'
import dotenv, { config } from 'dotenv'

dotenv.config()

const pool= mysql.createPool({
    host: process.env.HOST,
    user: process.env.USER,
    password:process.env.PASSWORD,
    //database:process.env.DATABASE,
});

export default pool