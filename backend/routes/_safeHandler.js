function safe(handler) {
  return async function safeHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (err) {
      console.error(err);
      if (res.headersSent) return next(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

module.exports = { safe };

