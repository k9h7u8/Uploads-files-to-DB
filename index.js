const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
require("dotenv").config();
const app = express();
app.set('view engine', 'ejs');

//Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));

//connect to mongoDB database
const connect = mongoose.createConnection(process.env.MONGODB_URI_CLOUD, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}, () => {
    console.log("Connected to MongoDB Database");
})

//Initialize gfs
let gfs, gridFSBucket;
//mdel of upload collection
connect.once('open', () => {
    //Initialize our stream
    gridFSBucket = new mongoose.mongo.GridFSBucket(connect.db, {
        bucketName: 'uploads'
    });
    //Create collection uploads
    gfs = Grid(connect.db, mongoose.mongo);
    gfs.collection('uploads')
})

//Create a storage engine
const storage = new GridFsStorage({
    //Url of mongoDB database
    url: process.env.MONGODB_URI_CLOUD,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            });
        });
    }
});
const upload = multer({ storage });

//@Route Get /
//@load Forms
app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        //check files exist or not
        if (!files || files.length === 0) {
            res.render('index', { files: false });
        } else {
            files.map(file => {
                if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
                    file.isImage = true;
                } else {
                    file.isImage = false;
                }
            })
            res.render('index', { files: files });
        }
    });
})

//@Route Post /upload
//@Upload file to DB
app.post('/upload', upload.single('file'), (req, res) => {
    // res.json({ file: req.file })
    res.redirect('/');
});

//@Route Get /files
//@display all files
app.get('/files', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        //check files exist or not
        if (!files || files.length === 0) {
            return res.status(404).json({
                err: 'no file exist',
            });
        }
        //Files exist
        return res.json(files);
    });
});

//@Route Get /files/:filename
//@display one single file
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        //check file exist or not
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'no file exist',
            });
        }
        //Files exist
        return res.json(file);
    });

});

//@Route Get /image/:filename
//@display one single file object
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        //check file exist or not
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exist',
            });
        }
        //Check if image
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
            //Read output to browser
            // const readstream = gfs.createReadStream(file.filename);
            const readStream = gridFSBucket.openDownloadStreamByName(file.filename);
            readStream.pipe(res);
        } else {
            res.status(404).json({
                err: 'Not an image',
            });
        }
    });
});

//@Route Delete /file/:id
//@Delete files
app.delete('/files/:id', async (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
        if (err) {
            return res.status(404).json({ err: err });
        }
        res.redirect('/');
    });
});

const port = 3030;
app.listen(port, console.log(`Server Started on port: ${port}`));