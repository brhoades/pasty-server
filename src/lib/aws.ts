import * as aws from "aws-sdk";
import * as config from "config";


// Reads credentials from the environment
// Upload some Base64 data to our configured aws bucket.
export const uploadAWS = (filename: string, data: any, cb: (err: Error, awsres: any) => void) => {
  const s3: aws.S3 = new aws.S3({apiVersion: '2006-03-01'});

  let res = s3.upload({
    Key: filename,
    Body: data,
    ContentType: "binary/octet-stream",
    ContentLength: data.length,
    ACL: <string>(config.get("server.storage.acl")),
    Bucket: <string>(config.get("server.storage.bucket")),
  }, cb);
}
