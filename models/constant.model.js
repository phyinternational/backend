const mongoose = require("mongoose");

const constantSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

mongoose.model("Constant", constantSchema);

const Constant = mongoose.model("Constant");

module.exports = Constant;
