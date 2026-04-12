// src/utils/response.js
'use strict';

/**
 * Send a successful JSON response.
 * @param {import('express').Response} res
 * @param {*} data     - payload
 * @param {string} [message]
 * @param {number} [statusCode=200]
 */
function success(res, data, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send an error JSON response.
 */
function error(res, message = 'Internal server error', statusCode = 500, details = null) {
  const body = { success: false, error: message, status: statusCode };
  if (details && process.env.NODE_ENV !== 'production') body.details = details;
  return res.status(statusCode).json(body);
}

/**
 * Send 400 Bad Request with validation errors.
 */
function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    status: 400,
    errors,
  });
}

module.exports = { success, error, validationError };
