const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Article = require('../models/Article.js');

router.get('/', (req, res, next) => {
    Article.find().then((articles) => {
        res.json(articles);
    }).catch((err) => {
        next(err);
    });
});

router.post('/', (req, res, next) => (
    Article.create(req.body)
        .then((post) => {
            res.json(post);
        })
        .catch((err) => {
            next(err);
        })
));

module.exports = router;

