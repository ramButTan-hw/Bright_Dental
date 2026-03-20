// Middleware to verify that a user is logged in via session token
// Attach token to request headers as: Authorization: Bearer <token>
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  // TODO: replace with JWT verification once auth tokens are implemented
  // For now, just checks that a token string is present
  req.token = token;
  next();
};

module.exports = verifyToken;
