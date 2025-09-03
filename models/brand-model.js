const { default: mongoose } = require("mongoose");

const brandSchema = new mongoose.Schema({
    brand_name: { type: String, required: true, unique: true }
});

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand;