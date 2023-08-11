const express = require("express");
const router = express.Router();
const { setEnvValues, getBaseURL} = require('../qurey/baseURL')

router.use(express.json());

router.post('/setUrl', async (req, res, next) => {
  const { baseURL } = req.body;
  setEnvValues(baseURL)

  res.json({
    message: 'Suceesfull',
    URL: baseURL,
  });
});

router.get('/getURL', async (req, res, next) => {
  const url = getBaseURL();
  if (url) {
      return res.json({ url }); 
  }
  res.status(404).json({ message: 'URL not found' }); 
});


module.exports = router;