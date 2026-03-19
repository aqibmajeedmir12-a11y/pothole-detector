require('dotenv').config();

const authenticateApiKey = (req, res, next) => {
  // Skip auth for GET requests in development
  if (req.method === 'GET' && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide an API key via x-api-key header or apiKey query parameter'
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ 
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  next();
};

module.exports = { authenticateApiKey };
