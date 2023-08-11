const express = require("express");
const router = express.Router();
const Journal = require('../models/journal');

// http://localhost:8000/scopus/journal?sortField=journal-name&sortOrder=desc

router.get('/journal', async (req, res, next) => {
    try {
        const { sortField, sortOrder, page } = req.query;
        const pageNumber = page || 1;
        const limit = 20;

        const sortQuery = {};
        if (sortField === 'journal-name') {
            sortQuery['journal_name'] = sortOrder === 'desc' ? -1 : 1;
        }

        const journals = await Journal.find({})
            .sort(sortQuery)
            .skip((pageNumber - 1) * limit)
            .limit(limit);

        res.json(journals);
    } catch (error) {
        next(error);
    }
});


router.get('/journal/getTotal', (req, res, next) => {
    Journal.countDocuments()
        .then((count) => {
            res.json({ count });
        })
        .catch((err) => {
            next(err);
        });
});

router.get('/journal/:source_id', async (req, res, next) => {
    try {
        const { source_id } = req.params;
        console.log(source_id)
        const journal = await Journal.find({ 'source_id': source_id });
        if (journal.length === 0) {
            return res.status(404).json(false);
        }
        res.json(journal);
    } catch (err) {
        next(err);
    }
});

router.get('/journal/citescore/:source_id', async (req, res, next) => {
    try {
        const { source_id } = req.params;
        console.log(source_id)
        const journal = await Journal.find({ 'source_id': source_id })
            .select('source_id cite_source');
        if (journal.length === 0) {
            return res.status(404).json(false);
        }
        res.json(journal);
    } catch (err) {
        next(err);
    }
});

router.get('/journal/name/:journalName', (req, res, next) => {
    const { journalName } = req.params;
    const query = {};

    if (journalName) {
        const regex = new RegExp(`.*${journalName}.*`, 'i');
        query.journal_name = { $regex: regex };
    }

    Journal.find(query)
        .then((journal) => {
            res.json(journal);
        })
        .catch((err) => {
            next(err);
        });
});

module.exports = router;