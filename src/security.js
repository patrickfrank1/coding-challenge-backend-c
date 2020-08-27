const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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