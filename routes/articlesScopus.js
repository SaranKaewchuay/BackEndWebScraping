const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Article = require('../models/ArticleScopus');

router.get('/article/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const article = await Article.findById(id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(article);
    } catch (err) {
        next(err);
    }
});

router.get('/article/authorId/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const article = await Article.find({ 'author_scopus_id': id });
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(article);
    } catch (err) {
        next(err);
    }
});

router.get('/article/eid/:eid', async (req, res, next) => {
    try {
        const { eid } = req.params;
        const article = await Article.find({ 'eid': eid })
            .select('eid first_author co_author');
        
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        res.json(article);
    } catch (err) {
        next(err);
    }
});



module.exports = router;
