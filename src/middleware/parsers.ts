import { json, urlencoded } from "body-parser";
import * as config from "config";


export const jsonParser = json({
  limit: <string>config.get("server.storage.size_limit"),
});

export const urlEncodedParser = urlencoded({
  extended: true,
  limit: <string>config.get("server.storage.size_limit"),
});
