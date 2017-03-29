const express = require("express");
const bodyParser = require('body-parser')
const config = require("config");
const path = require("path");
const fs = require("fs");
const filesizeParser = require('filesize-parser');

const app = express();

app.use(bodyParser.json({limit: config.get("server.storage.size_limit")}));       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  limit: config.get("server.storage.size_limit"),
  extended: true
}));

function error(msg) {
  return {
    error: msg
  };
}

// https://jsfiddle.net/Guffa/DDn6W/
function randomName(length) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP1234567890";
    var pass = "";
    for (var x = 0; x < length; x++) {
        var i = Math.floor(Math.random() * chars.length);
        pass += chars.charAt(i);
    }
    return pass;
}

function buildFilename(name) {
  if(config.get("server.storage.type") == "local") {
    const storage_path = config.get("server.storage.local.path");

    if(!fs.existsSync(storage_path)) {
      console.log(`"${storage_path}" does not exist, cannot create files in it.`);
      return;
    }

    return path.join(storage_path, name);
  } else {
    return `${config.get("server.storage.aws.baseurl")}${name}`;
  }
}

// Gets a unique filename that doesn't exist.
// Returns a hash of the name and full path to the file.
function getFilename() {
  let full_path = "";
  let name = "";

  // If we're local, verify this file doesn't exist
  if(config.get("server.storage.type") == "local") {
    do {
      name = randomName(config.get("server.storage.filename_length"));

      full_path = buildFilename(name);
    } while(fs.existsSync(full_path));
  } else {
    name = randomName(config.get("server.storage.filename_length"));
    full_path = buildFilename(name);
  }

  return {
    name: name,
    path: full_path
  };
}

// Reads credentials from the environment
// Upload some Base64 data to our configured aws bucket.
function uploadAWS(filename, data, cb) {
  const aws = require('aws-sdk');
  const s3 = new aws.S3({apiVersion: '2006-03-01'});

  let res = s3.upload({
    Key: filename,
    Body: data,
    ACL: config.get("server.storage.aws.acl"),
    Bucket: config.get("server.storage.aws.bucket"),
  }, cb);
}

// POST json with a data field
// Returns a JSON hash with "filename": "file name".
app.post("/paste", (req, res, next) => {
  let data = req.body.data;
  let max_size_raw = config.get("server.storage.size_limit");
  let max_size = filesizeParser(max_size_raw);

  res.setHeader("Access-Control-Allow-Origin", "*");

  if(data.length > filesizeParser(config.get("server.storage.size_limit"))) {
    res.send(error(`Provided file of size ${data.length} is larger than the limit ${max_size} (${max_size_raw})`));
    return next();
  }

  let file_details = getFilename();

  if(config.get("server.storage.type") == "local") {
    fs.writeFile(file_details.path, data, (err) => {
      res.send({
        filename: file_details.name,
        url: `${config.get("server.storage.local.external")}#${file_details.name}-`
      });

      return next();
    });

  } else if(config.get("server.storage.type") == "aws") {
    uploadAWS(file_details.name, data, (err, awsres) => {
      if(err) {
        res.send(error(err));

        return next();
      }

      res.send({
        filename: file_details.name,
        url: `${config.get("server.storage.local.external")}#${file_details.name}-`
      });

      return next();
    });
  }

});

app.get("/get/:file", (req, res, next) => {
  let file = req.params.file;
  let file_path = buildFilename(file);
  res.setHeader("Access-Control-Allow-Origin", "*");


  if(file.length != config.get("server.storage.filename_length")) {
    console.log(`${req.params.file} != config length`);
    return res.status(404) && next();
  }

  if(/[^A-Za-z0-9]/.exec(file) != null) {
    console.log(`${req.params.file} has bad characters`);
    return res.status(404) && next();
  }

  if(config.get("server.storage.type") == "local") {
    // read and send
    fs.exists(file_path, (exists) => {
      if(!exists) {
        console.log(`File ${file_path} does not exist.`);
        return res.status(404) && next();
      }

      fs.readFile(file_path, (err, data) => {
        if(err) {
          console.log(`Error in reading: ${err}`);
          return res.status(500) && next(err);
        }

        res.send(data);
        return next();

      });
    });
  } else if(config.get("server.storage.type") == "aws") {
    // 301
    res.redirect(301, buildFilename(file));
  }
});

app.listen(3000, () => {
  console.log("Pasty server is listening on port 3000!");
});
