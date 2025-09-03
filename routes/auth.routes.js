const express = require("express");
const router = express.Router();
const auth_controller = require("../controllers/auth.controller");
const {
  requireAdminLogin,
  requireUserLogin,
} = require("../middlewares/requireLogin");
const passport = require("passport");
const googleUser_Controller = require("../utility/google");

router.post("/admin/signup", auth_controller.adminSignup_post);
router.post("/admin/signin", auth_controller.adminSignin_post);
router.post("/user/signup", auth_controller.userSignup_post);
router.post("/user/signin", auth_controller.userSignin_post);
router.get("/user/current", requireAdminLogin, auth_controller.getAdminData);
router.get("/user/getData", requireUserLogin, auth_controller.getUserData);
router.get("/user/constants", auth_controller.getConstantData);
router.post("/user/constants", requireAdminLogin,auth_controller.updateConstansts);

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.send({
    message: "User logged out successfully",
  });
});

router.get("/admin/dashboard",requireAdminLogin,auth_controller.dashboardData);
router.get("/admin/constant",requireUserLogin,auth_controller.getConstantData);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  }),
  async (req, res) => {
    try {
      const result = await googleUser_Controller(req.user);
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      res.redirect(process.env.CLIENT_URL);
    } catch (error) {
      console.log(error);
    }
  }
);

/* router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: "/login/failed",
  }),
  function (req, res) {
    const token = req.user; // Assuming req.user contains the JWT token
    res.cookie("token", token, {
      httpOnly: true,
      // secure: true,
    });
    res.redirect(process.env.CLIENT_URL); // Redirect to the desired page after successful login
  }
);
 */
router.get(
  "/auth/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);

/* router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
  })
); */

module.exports = router;
