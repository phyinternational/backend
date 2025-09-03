const { default: mongoose } = require("mongoose");
const ProductImage = require("./models/product.model");
const { ObjectId } = require("mongodb");
const Constant = require("./models/constant.model");

mongoose.set("strictQuery", true);
mongoose.connect(
  "mongodb+srv://eventplanner:data123456@cluster0.guii3tm.mongodb.net/ecolove"
);
const database = mongoose.connection;

database.on("error", (err) => console.log(err, "Error connecting db."));
database.once("connected", () => console.log("Database Connected."));

Constant.create({
  name: "cod-charges",
  value: 0,
});

Constant.create({
  name: "shipping-charges",
  value: 0,
});
