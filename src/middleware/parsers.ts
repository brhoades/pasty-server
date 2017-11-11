import { json, raw, urlencoded } from "body-parser";
import * as config from "config";


export const rawParser = raw({
  limit: <string>config.get("server.storage.size_limit"),
  type: 'application/octet-stream'
});

export const jsonParser = json({
  limit: <string>config.get("server.storage.size_limit"),
});

export const urlEncodedParser = urlencoded({
  extended: true,
  limit: <string>config.get("server.storage.size_limit"),
});
