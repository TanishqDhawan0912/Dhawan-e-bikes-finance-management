const ErrorResponse = require("../utils/errorResponse");

// Middleware to protect admin routes with security key
const adminAuth = (req, res, next) => {
  const { securityKey } = req.body;

  if (!securityKey) {
    return next(
      new ErrorResponse("Security key is required for admin access", 401)
    );
  }

  if (securityKey !== process.env.ADMIN_SECURITY_KEY) {
    return next(new ErrorResponse("Invalid security key", 401));
  }

  next();
};

module.exports = adminAuth;
