require('dotenv').config();
const crypto = require('crypto');

/**
 * Timing-safe API key comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual to ensure constant-time comparison.
 */
function safeCompare(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const authenticateApiKey = (req, res, next) => {
  // Skip auth for GET requests in development mode
  if (req.method === 'GET' && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide an API key via x-api-key header',
    });
  }

  if (!safeCompare(apiKey, process.env.API_KEY)) {
    return res.status(403).json({
      error: 'Invalid API key',
    });
  }

  next();
};

module.exports = { authenticateApiKey };
