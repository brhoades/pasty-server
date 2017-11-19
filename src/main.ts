import * as express from "express";
import * as config from "config";
import * as path from "path";
import * as fs from "fs";
const filesizeParser = require("filesize-parser");

import generateId from "./lib/generate";
import { uploadAWS } from "./lib/aws";
import { error, tooLargeError } from "./lib/responses";
import applyMiddleware from "./middleware/index";


const app: express.Application = express();

applyMiddleware(app);

// Return a unique filename
function getFilename(): string {
  return generateId(<number>(config.get("server.storage.filename_length")));
}

// POST json with a data field
// Returns a JSON hash with "filename": "file name".
app.post("/paste", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let data = "";

  if (req.headers['content-type'] === "application/x-www-form-urlencode") {
    if (!req.body || !req.body.data || !req.body.data.length) {
        console.log("Bad request");
        return res.status(400).json(error("Expected a request with a data key."));
    }

    data = req.body.data;
  } else {
    data = req.body;
  }
  const maxSizeRaw: string = <string>config.get("server.storage.size_limit");
  const maxSize: number = filesizeParser(maxSizeRaw);

  if (data.length > maxSize) {
    return res.status(413).json(tooLargeError(data.length));
  }

  const filename: string = generateId(<number>(config.get("server.storage.filename_length")));

  uploadAWS(filename, data, (err, awsres) => {
    if (err) {
      return res.json(error(`AWS Error: ${err}`));
    }

    return res.json({ filename });
  });
});

app.get("/get/:file", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const file: string = req.params.file;
  const filePath: string = `${config.get("server.storage.baseurl")}${file}`;

  if (file.length !== config.get("server.storage.filename_length")) {
    console.log(`${req.params.file} != configured length`);
    return res.status(404);
  }

  if (/[^A-Za-z0-9_\-]/.test(file)) {
    console.log(`${req.params.file} has bad characters`);
    return res.status(404);
  }

  // 301
  res.redirect(301, filePath);
});


if (process.env.NODE_ENV === "development") {
  console.error("Running in development mode.");
  app.listen(3000, () => {
    console.log("Pasty server is listening on port 3000!");
  });
} else {
  app.listen(3000, () => {
    console.log("Pasty server is listening on port 3000!");
  });
}
