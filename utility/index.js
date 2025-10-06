const Razorpay = require("razorpay");
module.exports.successRes = (res, data) => {
  return res.json({
    status: "success",
    data,
  });
}; 

module.exports.errorRes = (res, code, message) => {
  return res.status(code).json({
    status: "error",
    error: {
      code,
      message,
    },
  });
};

module.exports.internalServerError = (res, err) => {
  console.log(err);
  return this.errorRes(res, 500, `Internal Server Error: ${err.message}`);
};

module.exports.shortIdChar =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@";

module.exports.hexcodeValidate = hexcode => {
  let regex = new RegExp(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

  if (!hexcode) return false;
  return regex.test(hexcode);
};

module.exports.pincodeValidator = pincode => {
  let regex = new RegExp(/^[1-9]{1}[0-9]{2}\s{0,1}[0-9]{3}$/);
  if (!pincode) return false;
  return regex.test(pincode);
};

module.exports.addressValidator = (address, pincode) => {
  if (!address || !pincode || !this.pincodeValidator(pincode)) return false;
  return true;
};

module.exports.firstLetterCapitalInString = str => {
  const words = str.split(" ");

  const result = words
    .map(word => word[0].toUpperCase() + word.substring(1).toLowerCase())
    .join(" ");
  return result;
};
 
module.exports.razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID||"rzp_test_8XQ",
  key_secret: process.env.RAZORPAY_KEY_SECRET||"8XQ",
});
