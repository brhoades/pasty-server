import * as config from "config";
const filesizeParser = require("filesize-parser");


export interface ErrorObject {
  error: string;
}

export const error = (error: string): ErrorObject => ({ error });

export const tooLargeError = (size: number): ErrorObject => {
  const maxSizeRaw: string = <string>config.get("server.storage.size_limit");
  const maxSize: number = filesizeParser(maxSizeRaw);

  return error(
    `Provided paste with size ${size} is larger than the limit ${maxSize} (${maxSizeRaw})`,
  );
};
