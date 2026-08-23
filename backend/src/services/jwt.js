'use strict';

const jwt = require('jsonwebtoken');

exports.signToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  if (!secret) {
    throw new Error('JWT_SECRET no esta definido en variables de entorno');
  }

  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
};

exports.signRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET no esta definido en variables de entorno');
  }

  return jwt.sign({ ...payload, type: 'refresh' }, secret, { algorithm: 'HS256', expiresIn: '30d' });
};

exports.verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no esta definido');
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
};

exports.verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET no esta definido');
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
};
