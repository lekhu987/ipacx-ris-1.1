const express = require("express");
const router = express.Router();
const mwlTargetsController = require("../controllers/mwlTargetsController");
const { syncLocalDimseScpState } = require("../services/mwlTargetsService");

router.get("/options", mwlTargetsController.getOptions);
router.get("/", mwlTargetsController.listTargets);
router.post("/", mwlTargetsController.upsertTarget);
router.delete("/:id", mwlTargetsController.deleteTarget);

module.exports = router;
module.exports.syncLocalDimseScpState = syncLocalDimseScpState;
