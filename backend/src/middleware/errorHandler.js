// src/middleware/errorHandler.js
'use strict';

/**
 * Global Express error handler.
 * Must have 4 parameters to be recognised as an error handler by Express.
 */
function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Supabase / Postgres errors
  if (err.code === 'PGRST116') {
    return res.status(404).json({ success: false, error: 'Resource not found', status: 404 });
  }

  // CORS error
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, error: err.message, status: 403 });
  }

  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body', status: 400 });
  }

  console.error(`[${req.method}] ${req.path} —`, err.message ?? err);

  return res.status(err.status ?? 500).json({
    success: false,
    error:   isDev ? (err.message ?? 'Internal server error') : 'Internal server error',
    status:  err.status ?? 500,
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
