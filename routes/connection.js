const express = require("express");
const router = express.Router();
const connectToMongoDB = require('../qurey/connectToMongoDB')
const fs = require('fs');

router.use(express.json());

router.post('/connect-to-mongodb', async (req, res, next) => {
    const { databaseURI } = req.body;
    // console.log("Received:", databaseURI); 

    await connectToMongoDB(databaseURI);

    res.json({
        message: 'Connecting to MongoDB...',
        Connection: databaseURI,
    });
});

router.get('/getDBUrl', async (req, res, next) => {
    const getDBURL = () => {
        const envFilePath = '.env';
        const envContent = fs.readFileSync(envFilePath, 'utf-8');
        const match = envContent.match(/DATABASE_URI=(.*)/);
        return match ? match[1] : null;
    };

    const url = getDBURL();
    if (url) {
        return res.json({ url });
    }
    res.status(404).json({ message: 'URL not found' });
});

module.exports = router;