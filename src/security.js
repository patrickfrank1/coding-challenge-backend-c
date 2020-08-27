const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');

// This will read the .env (if it exists) into process.env, for local testing
//require('dotenv').config();

// aws variables
const BUCKET = process.env.BUCKET;
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY
});

// module variables
const ipLimit = 20; // one ip address cannot create more than 50 users
const jwtKey = "tHiSiSaVeRySeCrEtKeY";

// write an array with object elements to file, use with readArray
module.exports.writeArray = (arr, filePath) => {
  const serialized = arr.reduce((accumulated, current) => {
    return accumulated += JSON.stringify(current) + '\n'
  }, "");

  fs.writeFileSync(filePath, serialized);
};

// upload file to s3
module.exports.uploadFile = (filePath, uploadPath) => {
  // create a file stream from file
  const fileStream = fs.createReadStream(filePath);
  const params = {
    Bucket: BUCKET,
    Key: uploadPath,
    Body: fileStream
  };
  s3.upload(params, function (err, data) {
    if (err) {
      console.log("Error", err);
    }
    if (data) {
      console.log("Uploaded in:", data.Location);
    }
  });
};

module.exports.appendObject = (obj, filePath) => {
  fs.appendFileSync(filePath, JSON.stringify(obj)+'\n');
};

// read a file and return an array of objects, use with writeArray
// if file cannot be found, return an empty array
module.exports.readArray = (filePath) => {
  try {
    const str = fs.readFileSync(filePath, {encoding: 'utf-8'});
    const arr = str.split("\n")
      .filter(el => el !== '')
      .map(el => JSON.parse(el));
    return arr;
  } catch (err) {
    return [];
  }
};

// download file from s3
module.exports.downloadFile = (filePath, downloadPath) => {
  console.log("entered download function");
  const s3 = new AWS.S3({
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_ACCESS_KEY
  });
  const params = {
        Bucket : BUCKET,
        Key: downloadPath
    };
  const writeStream = fs.createWriteStream(filePath);
  // download and write to file
  s3.getObject(params).createReadStream().pipe(writeStream);
  return 0;
};

// return true if ip is allowed to create a new user, false otherwise
// ip should be passed as string, returns if user creation allowed and list of updated ips
module.exports.checkIp = (requestIp, ips) => {
  const ipIndex = ips.findIndex(el => el.ip === requestIp);

  if (ipIndex > -1) { // ip exists in list
    ips[ipIndex].users += 1;

    if (ips[ipIndex].users > ipLimit) { // user creating limit reached
      return [false, ips];
    } else { // user creation allowed
      return [true, ips];
    }
  }
  else { // first user to be created
    ips.push({
      ip: requestIp,
      users: 1
    });
    return [true, ips];
  }
};

// add new user to 
module.exports.encryptUserPw = async (userObj) => {
  // create a different salt for each user
  const salt = await bcrypt.genSalt(10);
  // hash the password
  const hashedPassword = await bcrypt.hash(userObj.password, salt);
  const user = {
    username: userObj.username,
    password: hashedPassword
  };
  return user;
}

// check if user has an jwt access cookie set
module.exports.authenticateUser = (req, res, next) => {
  // retrieve the access token which is sored under that path in the reqest header
  const token = req.headers.cookie && req.headers.cookie.split("=")[1];
  if (!token) { // check if cookie was set
    return res.status(401).send("Login first before starting a request.");
  }
  // if set verify it with jwt, handle result with callback
  jwt.verify(token, jwtKey, (err, user) => {
    if (err) { // authentication failed
      return res.status(401).send("Authentication failed.");
    }
    // else middleware executes next function
    req.user = user;
    next();
  });
};