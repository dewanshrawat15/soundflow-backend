const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require("multer");
const { Readable } = require("stream");
const ObjectID = require('mongodb').ObjectID;

const conn = mongoose.connect(
    process.env.MONGO_URI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
);

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB @ 27017');
});
  
let UserSchema = new Schema({
    username: {type: String, required: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    hash: {type: String, required: true},
    salt: {type: String, required: true}
});

let AuthTokenSchema = new Schema({
    authToken: {type: String, required: true},
    username: {type: String, required: true}
});

let User = mongoose.model("User", UserSchema);
let AuthToken = mongoose.model("Auth Token", AuthTokenSchema);

const validatePassword = (password, salt, userHash) => {
    let hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return userHash === hash;
}

const createNewUser = (userData, res) => {
    let username = userData.username;
    let firstName = userData.firstName;
    let lastName = userData.lastName;
    let password = userData.password;
    let salt = crypto.randomBytes(16).toString('hex');
    let hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    
    let newUser = new User({
        username: username,
        firstName: firstName,
        lastName: lastName,
        salt: salt,
        hash: hash
    });

    newUser.save(function(err, data){
        if (err){
            res.json({
                "message": err
            });
        }
       else{
            let authToken = jwt.sign(username, process.env.TOKEN_SECRET);
            let newAuthToken = new AuthToken({
                username: username,
                authToken: authToken
            });
            newAuthToken.save(function(err, data){
                if(err){
                    res.json({
                        "message": err
                    });
                } else {
                    res.json({
                        "message": "New user created"
                    });
                }
            });
       }
    });
}

const loginUser = (username, password, res) => {
    User.findOne({ username: username }, function(err, user){
        if(err){
            console.error(err);
        }
        if(user === null){
            res.status(400).json({
                message: "User does not exist",
                login: false
            });
        }
        else{
            const validateUser = validatePassword(password, user.salt, user.hash);
            if(validateUser){
                AuthToken.findOne({ username: username }, function(err, authToken){
                    if(err){
                        console.error(err);
                    }
                    if(authToken === null){
                        res.status(400).json({
                            "message": "An internal error occured."
                        })
                    }
                    else{
                        res.status(201).json({
                            message: "User login successful",
                            authToken: authToken.authToken
                        });
                    }
                })
            }
            else{
                res.status(400).json({
                    message: "Wrong password",
                    login: false
                });
            }
        }
    });
}

const updatePassword = async (username, password, newPassword, res) => {
    User.findOne({ username: username }, function(err, user){
        if(err){
            console.error(err);
        }
        if(user === null){
            res.status(400).json({
                "message": "User does not exist"
            })
        }
        else{
            const validateUser = validatePassword(password, user.salt, user.hash);
            if(validateUser){
                let salt = crypto.randomBytes(16).toString('hex');
                let hash = crypto.pbkdf2Sync(newPassword, salt, 1000, 64, 'sha512').toString('hex');
                user.salt = salt;
                user.hash = hash;
                user.save(function(err, data){
                    if(err){
                        console.error(err);
                        res.status(400).json({
                            "message": "An error occured"
                        });
                    } else {
                        res.status(201).json({
                            "message": "Password updated"
                        });
                    }
                });
            }
            else{
                res.status(400).json({
                    "message": "User cannot be validated"
                });
            }
        }
    });
}

const checkIfUsernameExists = async (username) => {
    let records = await User.find({
        username: username
    });
    if (records.length === 0){
        return true;
    }
    else{
        return false;
    }
}

const getUser = async () => {
    let records = await User.find();
    let userRecords = [];
    records.forEach(element => {
        userRecords.push(element.toObject());
    });
    return userRecords;
}

const deleteAllRecords = async () => {
    await User.remove();
}

const deleteAuthTokens = async () => {
    await AuthToken.remove();
}

const uploadTrack = async (req, res, appSecret) => {
    if(appSecret === process.env.APP_SECRET){
        const storage = multer.memoryStorage();
        const upload = multer({
            storage: storage,
            limits: {
                fields: 1,
                fileSize: 6000000,
                files: 1,
                parts: 2
            }
        });
        upload.single('track')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ message: "Upload Request Validation Failed" });
            } else if (!req.body.name) {
                return res.status(400).json({ message: "No track name in request body" });
            }
            let trackName = req.body.name;
            const readableTrackStream = new Readable();
            readableTrackStream.push(req.file.buffer);
            readableTrackStream.push(null);
            let bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
                bucketName: "tracks"
            });
            let uploadStream = bucket.openUploadStream(trackName);
            let id = uploadStream.id;
            readableTrackStream.pipe(uploadStream);

            uploadStream.on('error', () => {
                return res.status(500).json({ message: "Error uploading file" });
            });

            uploadStream.on('finish', () => {
                return res.status(201).json({ message: "File uploaded successfully", "_id": id });
            });
        });
    } else {
        res.status(400).json({
            "message": "Wrong app secret"
        });
    }
}

const streamSoundTrack = async (req, res, _trackID, appSecret) => {
    if(appSecret === process.env.APP_SECRET){
        let trackID;
        try {
            trackID = new ObjectID(_trackID);
        } catch (err) {
            return res.status(400).json({ message: "Invalid trackID in URL parameter. Must be a single String of 12 bytes or a string of 24 hex characters" }); 
        }
        res.set('content-type', 'audio/mp3');
        res.set('accept-ranges', 'bytes');
        let bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "tracks"
        });
        let downloadStream = bucket.openDownloadStream(trackID);
        downloadStream.on('data', (chunk) => {
            res.write(chunk);
        });
        downloadStream.on('error', () => {
            res.sendStatus(404);
        });
        downloadStream.on('end', () => {
            res.end();
        });
    } else {
        res.status(400).json({
            "message": "Wrong app secret"
        });
    }
}

const fetchAllSoundTracks = async (req, res) => {
    const appSecret = req.headers.app_secret;
    if(appSecret === process.env.APP_SECRET){
        const collection = mongoose.connection.db.collection("tracks.files");
        collection.find({}, function(err, data){
            if(err){
                res.status(400).json({
                    "message": err
                });
            } else {
                const host = req.headers.host;
                soundTracks = [];
                const subPath = "/track/";
                const baseUrl = host + subPath;
                data.forEach(item => {
                    const soundTrackUrl = baseUrl + item._id;
                    soundTracks.push(soundTrackUrl);
                }).then(() => {
                    res.status(200).json({
                        "message": soundTracks
                    });
                });
            }
        });
    } else {
        res.status(400).json({
            "message": "Invalid app secret"
        });
    }
}

exports.createNewUser = createNewUser;
exports.getAllUsers = getUser;
exports.checkIfUsernameExists = checkIfUsernameExists;
exports.deleteRecords = deleteAllRecords;
exports.loginUser = loginUser;
exports.updatePassword = updatePassword;
exports.deleteAuthTokens = deleteAuthTokens;
exports.uploadTrack = uploadTrack;
exports.streamSoundTrack = streamSoundTrack;
exports.fetchAllSoundTracks = fetchAllSoundTracks;