// src/middleware/validate.js
'use strict';

const { validationResult } = require('express-validator');
const { validationError }  = require('../utils/response');

/**
 * Run after express-validator chains.
 * If there are errors, returns 400 with structured error list.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array().map(e => ({
      field:   e.path,
      message: e.msg,
    })));
  }
  next();
}

module.exports = { validate };
