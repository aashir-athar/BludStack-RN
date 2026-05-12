// api/index.js
// Vercel serverless function entrypoint.
//
// Vercel sets `process.env.VERCEL=1`, which makes src/server.js skip
// app.listen() and the long-running worker. We just re-export the Express
// `app` — Vercel's @vercel/node runtime wraps it as a Node HTTP handler.
//
// Any request to /api/* hits this file (via vercel.json rewrites), which then
// matches against the routes mounted in src/server.js (/api/v1/auth, etc.).
module.exports = require('../src/server.js');
