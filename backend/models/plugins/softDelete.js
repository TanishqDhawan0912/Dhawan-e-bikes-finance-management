/**
 * Soft delete plugin
 * - Adds `isDeleted` to schema
 * - Hides deleted docs by default on find/count/aggregate
 *
 * If a query explicitly sets `isDeleted`, the plugin will not override it.
 */
module.exports = function softDeletePlugin(schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
  });

  function applyNotDeletedFilter(next) {
    const filter = this.getFilter ? this.getFilter() : this._conditions || {};
    if (filter && Object.prototype.hasOwnProperty.call(filter, "isDeleted")) {
      return next();
    }
    // Default: hide deleted documents. Treat missing isDeleted as "not deleted".
    this.where({ isDeleted: { $ne: true } });
    return next();
  }

  schema.pre(/^find/, applyNotDeletedFilter);
  schema.pre("countDocuments", applyNotDeletedFilter);
  schema.pre("estimatedDocumentCount", function (next) {
    // estimatedDocumentCount ignores filters by design; keep behavior unchanged.
    next();
  });

  schema.pre("aggregate", function (next) {
    const pipeline = this.pipeline();
    const hasIsDeletedMatch = pipeline.some(
      (stage) =>
        stage &&
        stage.$match &&
        Object.prototype.hasOwnProperty.call(stage.$match, "isDeleted")
    );
    if (!hasIsDeletedMatch) {
      // Treat missing isDeleted as "not deleted".
      this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
    }
    next();
  });
};

