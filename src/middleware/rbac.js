const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

function requireAuthenticatedUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    req.user._id = payload.id; // Map id to _id for existing codebase compatibility
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireRole(...allowedRoles) {
  return [requireAuthenticatedUser, requireAllowedRole(allowedRoles)];
}

function requireAllowedRole(allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden.',
        requiredRoles: allowedRoles,
      });
    }
    return next();
  };
}

const requireAdmin = requireRole('Admin');

module.exports = {
  requireAdmin,
  requireAuthenticatedUser,
  requireRole,
};
