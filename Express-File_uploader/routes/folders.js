var express = require('express');
var router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// AUTHENTICATIO MIDDLEWEAR
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login'); // Redirect to login if not authenticated
}

/* GET users listing. */
router.post('/', ensureAuthenticated, async function (req, res, next) {
    const folderName = req.body.folderName.trim();
    try {
        await prisma.folder.create({
            data: {
                name: folderName,
                owner: { connect: { id: req.user.id } }
            },
        })
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while creating the folder" });
    }
});

module.exports = router;
