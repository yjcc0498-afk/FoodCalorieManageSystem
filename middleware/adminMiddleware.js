//身份认证（auth） + 权限校验（role）

const { isAdminUser } = require('../utils/permissions');

const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication is required before admin authorization.'
    });
  }

  if (!isAdminUser(req.user)) {
    return res.status(403).json({
      message: 'Admin access required.'
    });
  }

  return next();
};

module.exports = adminMiddleware;
