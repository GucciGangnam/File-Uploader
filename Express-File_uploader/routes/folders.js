var express = require('express');
var router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const storage = multer.memoryStorage(); // Use memory storage to handle file upload directly in memory
const upload = multer({ storage: storage });
require('dotenv').config();


// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


// AUTHENTICATIO MIDDLEWEAR
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login'); // Redirect to login if not authenticated
}

// GET A FOLDER
router.get('/:id', ensureAuthenticated, async function (req, res, est) {
    const folderId = req.params.id;
    console.log(folderId);
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: folderId
            }
        })
        const files = await prisma.file.findMany({
            where: {
                folderId: folderId
            }
        })
        if (!folder) {
            throw new Error("can't find that folder");
        }
        if (!files) {
            throw new Error("can't find those files");
        }
        console.log(files);
        res.render('folder', { folderName: folder.name, folderfiles: files, folderId: folder.id });
    } catch (error) {
        console.error(error)
        res.redirect('/')
    }
})

/* CEATE FOLDER. */
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


// UPDATER FOLDER NAME 
router.post('/updatename/:id', ensureAuthenticated, async function (req, res, next) {
    try {
        const newName = req.body.folderName;
        await prisma.folder.update({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            data: {
                name: newName
            }
        });
        res.redirect(`/folders/${req.params.id}`)
        return;
    } catch (error) {
        console.error(error);
        res.redirect('/')
    }
})

// DELETE FOLDER AND CONTENS 
router.delete('/deletefolder/:id', ensureAuthenticated, async function (req, res, next) { 
    try {
        // Find the folder in the database
        const folderTD = await prisma.folder.findFirst({
            where: { 
                id: req.params.id
            }
        });
        if (!folderTD) {
            console.error('Folder not found');
            return res.status(404).json({ success: false, message: 'Folder not found' });
        }
        // Find all files in the folder
        const allFilesInFolder = await prisma.file.findMany({
            where: { 
                folderId: req.params.id
            }
        });
        // Iterate over the files and delete them from Cloudinary and the database
        for (const file of allFilesInFolder) {
            // Extract the Cloudinary public ID
            const cloudinaryUrlParts = file.url.split('/');
            const cloudinaryPublicIdWithExtension = cloudinaryUrlParts[cloudinaryUrlParts.length - 1];
            const cloudinaryPublicId = cloudinaryPublicIdWithExtension.split('.')[0];
            // Delete the file from Cloudinary
            await new Promise((resolve, reject) => {
                cloudinary.uploader.destroy(cloudinaryPublicId, function (error, result) {
                    if (error) {
                        console.error('Error deleting file from Cloudinary:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
            // Delete the file from the database
            await prisma.file.delete({
                where: {
                    id: file.id
                }
            });
        }
        // Delete the folder from the database
        await prisma.folder.delete({
            where: { 
                id: req.params.id
            }
        });
        console.log('Folder and all files deleted successfully');
        return res.status(200).json({ success: true, message: 'Folder and all files deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// UPLOAD FILE TO CLOUDINARY
router.post('/uploadfile/:id', ensureAuthenticated, upload.single('file'), async function (req, res, next) {
    console.log('uploading file...?');
    console.log('Folder ID:', req.params.id);
    console.log('File:', req.file);

    try {
        if (!req.file || !req.file.buffer) {
            throw new Error('No file or file buffer available');
        }

        // Upload file to Cloudinary
        cloudinary.uploader.upload_stream(
            { resource_type: 'auto' },
            async (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return res.status(500).json({ error: 'Error uploading to Cloudinary' });
                }

                // Get the Cloudinary URL
                const cloudinaryUrl = result.secure_url;

                try {
                    // Create a new file entry in the database
                    await prisma.file.create({
                        data: {
                            name: req.file.originalname,
                            url: cloudinaryUrl,
                            userId: req.user.id, // Assuming you have req.user with the authenticated user
                            folderId: req.params.id,
                        }
                    });

                    // Send a success response after the file is saved to the database
                    return res.status(200).json({ success: true, message: 'File uploaded and saved successfully' });

                } catch (dbError) {
                    console.error('Error saving file to database:', dbError);
                    return res.status(500).json({ error: 'Error saving file to database' });
                }
            }
        ).end(req.file.buffer);
    } catch (error) {
        console.error('Error in /uploadfile route:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// DELETE FILE

router.delete('/deletefile/:id', ensureAuthenticated, async function (req, res, next) {
    console.log('Delete request received for file ID:', req.params.id);
    try {
        // Find the file
        const fileTD = await prisma.file.findFirst({
            where: {
                id: req.params.id
            }
        });

        if (!fileTD) {
            console.error('File not found');
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        // Extract the Cloudinary public ID from the URL
        const cloudinaryPublicId = fileTD.url.split('/').pop().split('.')[0]; // Assuming the URL format is standard
        console.log("The piublic ID is " + cloudinaryPublicId)

        // Delete the file from Cloudinary
        cloudinary.uploader.destroy(cloudinaryPublicId, async function (error, result) {
            if (error) {
                console.error('Error deleting file from Cloudinary:', error);
                return res.status(500).json({ success: false, message: 'Error deleting file from Cloudinary' });
            }

            // Delete the file from the database
            try {
                await prisma.file.delete({
                    where: {
                        id: req.params.id
                    }
                });

                console.log('File deleted successfully from Cloudinary and database');
                return res.status(200).json({ success: true, message: 'File deleted successfully' });
            } catch (dbError) {
                console.error('Error deleting file from database:', dbError);
                return res.status(500).json({ success: false, message: 'Error deleting file from database' });
            }
        });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});



module.exports = router;
