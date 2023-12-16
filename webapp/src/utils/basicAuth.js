import User from '../models/user.js';
import bcrypt from 'bcrypt';
import logger from './logger.js'

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).send('Unauthorized');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (!username || !password) {
    return res.status(401).send('Unauthorized');
  }

  User.findOne({ where: { email: username } })
    .then((user) => {
      if (!user) {
        return res.status(401).send('Unauthorized');
      }

      // Compare the provided password with the hashed password stored in the database
      return bcrypt.compare(password, user.password);
    })
    .then((validPassword) => {
      if (!validPassword) {
        return res.status(401).send('Unauthorized');
      }

      // Authentication successful
      req.name = username;
      next();
    })
    .catch((error) => {
      console.error('Authentication error:', error);
      return res.status(500).send('Internal Server Error');
    });
}

export default authenticate;
