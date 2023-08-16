const express = require("express");
const router = express.Router();
const { connectToMongoDB, getDBURL } = require('../qurey/connectToMongoDB')
const fs = require('fs');
const path = require('path');

router.use(express.json());

router.post('/connect-to-mongodb', async (req, res, next) => {
    const { databaseURI } = req.body;

    try {
        const isConnected = await connectToMongoDB(databaseURI);

        if (isConnected) {
            res.json({
                message: 'Successfully connected to MongoDB',
                connection: databaseURI,
            });
        } else {
            res.status(500).json({
                message: 'Failed to connect to MongoDB',
            });
        }
    } catch (error) {
        res.status(500).json({
            message: 'An error occurred while connecting to MongoDB',
            error: error.message,
        });
    }
});


router.get('/getDBUrl', async (req, res, next) => {
    const url = getDBURL();
    if (url) {
        return res.json({ url });
    }
    res.status(404).json({ message: 'URL not found' });
});

module.exports = router;