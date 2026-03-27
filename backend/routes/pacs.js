const express = require("express");
const router = express.Router();
const pacsController = require("../controllers/pacsController");

router.get("/", pacsController.list);
router.post("/", pacsController.save);
router.delete("/:id", pacsController.remove);
router.post("/:id/activate", pacsController.activate);
router.post("/:id/deactivate", pacsController.deactivate);
router.post("/test", pacsController.test);
router.get("/studies", pacsController.listStudies);
router.post("/:id/sync", pacsController.sync);

module.exports = router;
