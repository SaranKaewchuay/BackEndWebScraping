const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Author = require('../models/Author.js');


// http://localhost:8000/authors?sortField=document-count&sortOrder=desc
router.get('/author', async (req, res, next) => {
    try {
        const { sortField, sortOrder, page } = req.query;
        const pageNumber = page || 1;
        const limit = 20;

        const sortQuery = {};
        if (sortField === 'h-index') {
            sortQuery.h_index = sortOrder === 'desc' ? -1 : 1;
        } else if (sortField === 'document-count') {
            sortQuery.documents = sortOrder === 'desc' ? -1 : 1;
        } else if (sortField === 'name') {
            sortQuery.author_name = sortOrder === 'desc' ? -1 : 1;
        }

        const authors = await Author.aggregate([
            {
                $addFields: {
                    documents: {
                        $cond: {
                            if: { $eq: ['$documents', ''] },
                            then: 0,
                            else: { $toInt: '$documents' }
                        }
                    },
                    h_index: {
                        $cond: {
                            if: { $eq: ['$citation_by.table.h_index.all', null] },
                            then: 0,
                            else: { $toInt: { $arrayElemAt: ['$citation_by.table.h_index.all', 0] } }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    author_name: 1,
                    department: 1,
                    subject_area: 1,
                    image: 1,
                    h_index: { $ifNull: ['$h_index', 0] },
                    documents: 1
                }
            },
            {
                $sort: sortQuery
            },
            {
                $skip: (pageNumber - 1) * limit
            },
            {
                $limit: limit
            }
        ]);

        res.json(authors);
    } catch (error) {
        next(error);
    }
});

router.get('/author/getTotal', (req, res, next) => {
    Author.countDocuments()
      .then((count) => {
        res.json({ count });
      })
      .catch((err) => {
        next(err);
      });
  });

router.get('/author/:id', (req, res, next) => {
    const authorId = req.params.id;
    Author.findById(authorId)
        .then((author) => {
            if (!author) {
                return res.status(404).json({ message: 'Author not found' });
            }
            res.json(author);
        })
        .catch((err) => {
            next(err);
        });
});

router.get('/author/name/:authorName', async (req, res, next) => {
    try {
        const { authorName } = req.params;
        const query = {};

        if (authorName) {
            const regex = new RegExp(`.*${authorName}.*`, 'i');
            query.author_name = { $regex: regex };
        }

        const authors = await Author.aggregate([
            {
                $addFields: {
                    h_index: {
                        $cond: {
                            if: { $eq: ['$citation_by.table.h_index.all', null] },
                            then: 0,
                            else: { $toInt: { $arrayElemAt: ['$citation_by.table.h_index.all', 0] } }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    author_name: 1,
                    department: 1,
                    subject_area: 1,
                    image: 1,
                    h_index: { $ifNull: ['$h_index', 0] },
                    documents: 1
                }
            },
            {
                $match: query
            }
        ]);
        res.json(authors);
    } catch (error) {
        next(error);
    }
});

module.exports = router;