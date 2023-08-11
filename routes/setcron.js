const express = require("express");
const router = express.Router();
const { setEnvValues, getCron } = require('../qurey/setCron')

router.use(express.json());

router.post('/setCron', async (req, res, next) => {
  const { timeCron } = req.body;
  console.log("check timeCron", timeCron);
  setEnvValues(timeCron);

  res.json({
    message: 'Successful',
    timeCron: timeCron,
  });
});

router.get('/getCron', async (req, res, next) => {
  const cron = getCron();
  if (cron) {
      return res.json({ cron }); 
  }
  res.status(404).json({ message: 'URL not found' }); 
});



module.exports = router;

