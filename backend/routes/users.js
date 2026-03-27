const express = require("express");
const router = express.Router();
const uploadSignature = require("../middleware/uploadSignature");
const usersController = require("../controllers/usersController");

router.post("/", uploadSignature.single("signature"), usersController.createUser);
router.get("/", usersController.listUsers);
router.put("/:id", uploadSignature.single("signature"), usersController.updateUser);
router.put("/:id/toggle", usersController.toggleUser);
router.delete("/:id", usersController.deleteUser);
router.get("/approved-by/:username", usersController.approvedBy);

module.exports = router;
