import * as config from "config";
import {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from "express";
const filesizeParser = require("filesize-parser");

import { abusePreventionTriggered, tooLargeError } from "../lib/responses";
import { canUpload, addUpload } from "../lib/abuse";


const abusePrevention = (req: any, res: any, next: () => void): void => {
  const maxSizeRaw: string = <string>config.get("server.storage.size_limit");
  const maxSize: number = filesizeParser(maxSizeRaw);
  let data;

  if (req.method !== "POST") {
    next();
    return;
  }

  if (req.headers['content-type'] === "application/x-www-form-urlencode") {
    data = req.body.data;
  } else {
    data = req.body;
  }

  if (data.length > maxSize) {
    return res.status(413).json(tooLargeError(data.length));
  }

  canUpload(req.ip, data.length, (allowed, delay) => {
    if (!allowed) {
      return res.status(429).json(abusePreventionTriggered(delay));
    }

    next();
  });
};

export default abusePrevention;
