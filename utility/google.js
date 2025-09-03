const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models/user.model");
const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN;
const JWT_SECRET_USER = process.env.JWT_SECRET_USER;

const passwordGenerator = () => {
  return Math.random().toString(36).slice(-8);
};
const googleUser_Controller = async (profile) => {
  try {
    const email = profile.emails[0].value;
    const image = profile.photos[0].value;

    let user = await User.findOne({ email });

    if (user) {
      const token = jwt.sign({ _id: user._id, role: "user" }, JWT_SECRET_USER);
     console.log(token,"token");
      return {
        error: null,
        authenticated: true,
        token: token,
        user: user,
      };
    } else {
      const hashedPassword = await bcrypt.hash(passwordGenerator(), 10);

      user = new User({
        name: profile.displayName,
        email: email,
        password: hashedPassword,
        profileImageUrl: image,
      });

      await user.save();

      const newCart = new User_Cart({
        userId: savedUser._id,
        products: [],
      });
      const cart = await newCart.save();
      
      const token = jwt.sign({ _id: user._id, role: "user" }, JWT_SECRET_USER);

      return {
        error: null,
        authenticated: true,
        token: token,
        user: {
          id: user.id,
          googleId: user.googleId,
          username: user.username,
          email: user.email,
          image: user.profileImageUrl,
          role: user.accountType,
        },
      };
    }
  } catch (error) {
    return {
      error: error.message,
      authenticated: false,
      token: null,
      user: null,
    };
  }
};

module.exports = googleUser_Controller;
