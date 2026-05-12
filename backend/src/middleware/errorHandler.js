// src/middleware/errorHandler.js
'use strict';

/**
 * Global Express error handler.
 * Must have 4 parameters to be recognised as an error handler by Express.
 *
 * Surfaces the Postgres / Supabase error code + message back to the client
 * when DEBUG_ERRORS=1 (or NODE_ENV != production). Production with the flag
 * unset still returns the generic "Internal server error" message.
 */
function errorHandler(err, req, res, _next) {
  const isDev    = process.env.NODE_ENV !== 'production';
  const debugErr = isDev || process.env.DEBUG_ERRORS === '1';

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

  // Structured server-side log (goes to Vercel function logs)
  console.error(`[err] ${req.method} ${req.path}`, {
    code:    err.code,
    message: err.message,
    details: err.details,
    hint:    err.hint,
  });

  return res.status(err.status ?? 500).json({
    success: false,
    error:   debugErr ? (err.message ?? 'Internal server error') : 'Internal server error',
    status:  err.status ?? 500,
    ...(debugErr && {
      pgCode:  err.code,
      pgHint:  err.hint,
      details: err.details,
    }),
  });
}

module.exports = { errorHandler };
