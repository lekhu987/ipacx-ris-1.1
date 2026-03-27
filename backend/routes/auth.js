const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/verify", authController.verify);
router.get("/me", authController.requireAuth, authController.me);
router.post("/refresh", authController.requireAuth, authController.refresh);

module.exports = router;
