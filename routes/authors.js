const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Author = require('../models/Author.js');

//findall
router.get('/', (req, res, next) => {
    Author.find().then((authors) => {
        res.json(authors);
    }).catch((err) => {
        next(err);
    });
});

router.get('/author/:authorName', (req, res, next) => {
    const { authorName } = req.params;
    const query = {};

    if (authorName) {
        const regex = new RegExp(`^${authorName}`, 'i');
        query.authorName = { $regex: regex };
    }

    Author.find(query)
        .then((authors) => {
            res.json(authors);
        })
        .catch((err) => {
            next(err);
        });
});

router.get('/department/:department', (req, res, next) => {
    const { department } = req.params;
    const query = {};

    if (department) {
        const regex = new RegExp(department, 'i');
        query.department = { $regex: regex };
    }

    Author.find(query)
        .then((authors) => {
            res.json(authors);
        })
        .catch((err) => {
            next(err);
        });
});


module.exports = router;
