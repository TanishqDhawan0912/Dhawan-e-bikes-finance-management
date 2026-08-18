const mongoose = require("mongoose");

const qrRecordSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      unique: true,
      index: true,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.QRRecord || mongoose.model("QRRecord", qrRecordSchema);
