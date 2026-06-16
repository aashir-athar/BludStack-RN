// src/middleware/requestLogger.js
'use strict';

const { randomUUID } = require('node:crypto');

function requestLogger(req, _res, next) {
  req.requestId = randomUUID();
  req.startTime = Date.now();
  next();
}

module.exports = { requestLogger };
