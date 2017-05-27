import * as express from "express"
import * as aws from "aws-sdk"
import * as bodyParser from "body-parser"
import * as config from "config"
import * as path from "path"
import * as fs from "fs"
const filesizeParser = require("filesize-parser");

const app: express.Application = express();

//CORS middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
});


app.use(bodyParser.urlencoded({
  extended: true,
  limit: "50mb" // a higher limit. We will send 200's with errors back before this. Afterwards, just a 314.
}));

function error(msg: string): { error: string } {
  return {
    error: msg
  };
}

// https://jsfiddle.net/Guffa/DDn6W/
function randomName(length: number): string {
    const chars: string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP1234567890";
    let pass: string = "";

    for(let x: number = 0; x < length; x++) {
      let i: number = Math.floor(Math.random() * chars.length);
      pass += chars.charAt(i);
    }

    return pass;
}

function buildFilename(name: string): string | null {
  if(config.get("server.storage.type") == "local") {
    const storage_path: string = <string>(config.get("server.storage.local.path"));

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
function getFilename(): { name: string, path: string } {
  let full_path: string = "";
  let name: string = "";

  // If we're local, verify this file doesn't exist
  if(config.get("server.storage.type") == "local") {
    do {
      name = randomName(<number>(config.get("server.storage.filename_length")));
      full_path = buildFilename(name);
    } while(fs.existsSync(full_path));

  } else {
    name = randomName(<number>(config.get("server.storage.filename_length")));
    full_path = buildFilename(name);
  }

  return {
    name: name,
    path: full_path
  };
}

// Reads credentials from the environment
// Upload some Base64 data to our configured aws bucket.
function uploadAWS(filename: string,
                   data: {},
                   cb: (err: string, awsres: string) => void) {
  const s3: aws.S3 = new aws.S3({apiVersion: '2006-03-01'});

  let res = s3.upload({
    Key: filename,
    Body: data,
    ACL: <string>(config.get("server.storage.aws.acl")),
    Bucket: <string>(config.get("server.storage.aws.bucket")),
  }, cb);
}

// POST json with a data field
// Returns a JSON hash with "filename": "file name".
app.post("/paste", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let data = req.body.data;
  let max_size_raw = config.get("server.storage.size_limit");
  let max_size = filesizeParser(max_size_raw);

  if(data.length > filesizeParser(config.get("server.storage.size_limit"))) {
    res.send(error(`Provided file of size ${data.length} is larger than the limit ${max_size} (${max_size_raw})`));
    return next();
  }

  let file_details = getFilename();

  if(config.get("server.storage.type") == "local") {
    fs.writeFile(file_details.path, data, (err: string) => {
      res.send({
        filename: file_details.name,
        url: `${config.get("server.storage.local.external")}#${file_details.name}-`
      });

      return next();
    });

  } else if(config.get("server.storage.type") == "aws") {
    uploadAWS(file_details.name, data, (err, awsres) => {
      if(err) {
        res.send(error(`AWS Error: ${err}`));

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

app.get("/get/:file", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let file = req.params.file;
  let file_path = buildFilename(file);


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
    fs.exists(file_path, (exists: boolean) => {
      if(!exists) {
        console.log(`File ${file_path} does not exist.`);
        return res.status(404) && next();
      }

      fs.readFile(file_path, (err: Error, data: {}) => {
        if(err) {
          console.log(`Error in reading: ${err}`);
          res.status(500) && next(err);
          return;
        }

        res.send(data);
        next();
        return;
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
