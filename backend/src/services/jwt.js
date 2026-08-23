'use strict';

const jwt = require('jsonwebtoken');

exports.signToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  if (!secret) {
    throw new Error('JWT_SECRET no esta definido en variables de entorno');
  }

  return jwt.sign(payload, secret, { expiresIn });
};

exports.signRefreshToken = (payload) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no esta definido en variables de entorno');
  }

  return jwt.sign({ ...payload, type: 'refresh' }, secret, { expiresIn: '30d' });
};

exports.verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no esta definido');
  return jwt.verify(token, secret);
};
