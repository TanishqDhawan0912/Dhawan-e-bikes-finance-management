// This is a wrapper function that handles async/await errors
const asyncHandler = (fn) => (req, res, next) => {
  // Resolve the promise returned by the controller function
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
