const mwlDimseService = require("../services/mwlDimseService");

async function health(req, res) {
  const status = await mwlDimseService.getHealth();
  return res.json(status);
}

function test(req, res) {
  try {
    const result = mwlDimseService.runDimseTest(req.body || {});
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (err.payload) {
      return res.status(status).json(err.payload);
    }
    return res.status(status).json({ success: false, error: err.message || "Test failed" });
  }
}

module.exports = { health, test };
