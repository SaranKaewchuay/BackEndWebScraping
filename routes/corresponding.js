const express = require("express");
const router = express.Router();
const Corresponding = require('../models/Corresponding');

// HTTP://127.0.0.1:8080/scholar/article/:id
// HTTP://127.0.0.1:8080/scholar/article/authorId/:authorId?

router.get('/coresponding/:eid', async (req, res, next) => {
    try {
        const { eid } = req.params;
        console.log(eid)
        const cores = await Corresponding.find({ 'scopusEID': eid });
        console.log(cores)
        if (cores.length === 0) {
            return res.status(404).json({ error: 'Coresponding not found' });
        }
        res.status(200).json(cores);
    } catch (err) {
        next(err);
    }
});

module.exports = router;