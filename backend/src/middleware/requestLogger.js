// src/middleware/requestLogger.js
'use strict';

const { v4: uuidv4 } = require('uuid');

function requestLogger(req, _res, next) {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  next();
}

module.exports = { requestLogger };
