
import Sequelize  from 'sequelize'
import config from '../config/config.js';
import mariadb from 'mariadb'

//importing Sequelize() class
export const sequelize = new Sequelize(config.DATABASE, config.USER, config.PASSWORD, {
    host: config.HOST,   
    dialect : "mariadb",
    allowPublicKeyRetrieval: true,
});

const pool = mariadb.createPool({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
});

export async function dbconnect() {
    try {
        const connection = await pool.getConnection();
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DATABASE}`);
        connection.release();
        

        await sequelize.sync();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}
dbconnect()

export default sequelize