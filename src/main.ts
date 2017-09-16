import * as express from "express";
import * as bodyParser from "body-parser";
import * as config from "config";
import * as path from "path";
import * as fs from "fs";

import generateId from "./lib/generate";
import { uploadAWS } from "./lib/aws";
import corsMiddleware from "./middleware/cors";


const filesizeParser = require("filesize-parser");
const app: express.Application = express();

//CORS middleware
app.use(corsMiddleware);

app.use(bodyParser.urlencoded({
  extended: true,
  limit: "5mb",
}));

function error(msg: string): { error: string } {
  return {
    error: msg,
  };
}

// Return a unique filename
function getFilename(): string {
  return generateId(<number>(config.get("server.storage.filename_length")));
}

// POST json with a data field
// Returns a JSON hash with "filename": "file name".
app.post("/paste", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const data = req.body.data;
  const maxSizeRaw: string = <string>config.get("server.storage.size_limit");
  const maxSize: number = filesizeParser(maxSizeRaw);

  if (data.length > maxSize) {
    res.send(error(
      `Provided file of size ${data.length} is larger than the limit ${maxSize} (${maxSizeRaw})`
    ));
    return next();
  }

  const filename: string = generateId(<number>(config.get("server.storage.filename_length")));

  uploadAWS(filename, data, (err, awsres) => {
    if (err) {
      res.send(error(`AWS Error: ${err}`));

      return next();
    }

    res.send({
      filename,
    });

    return next();
  });
});

app.get("/get/:file", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const file: string = req.params.file;
  const filePath: string = `${config.get("server.storage.aws.baseurl")}${file}`;

  if (file.length !== config.get("server.storage.filename_length")) {
    console.log(`${req.params.file} != configured length`);
    return res.status(404) && next();
  }

  if (/[^A-Za-z0-9_\-]/.test(file)) {
    console.log(`${req.params.file} has bad characters`);
    return res.status(404) && next();
  }

  // 301
  res.redirect(301, filePath);
});

app.listen(3000, () => {
  console.log("Pasty server is listening on port 3000!");
});
