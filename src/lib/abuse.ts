import * as config from "config";
const filesizeParser = require("filesize-parser");
const { Address6, Address4 } = require("ip-address");
import { Op } from "sequelize";

import { Client, Usage } from "./db";


// Bucket IPs into groups of 2^3 IPs. These buckets then used with
// a salt to associate them with a usage.
const bucketIP = (ip: string): string => {
  let address = new Address4(ip);
  if (!address.valid) {
    address = new Address6(ip);

    if (!address.valid) {
      throw Error(`Unknown error parsing IP address "${ip}"`)
    }
  }

  return `${address.bigInteger() % Math.pow(2, 32 - 3)}`; // buckets of 8 IPs for IPv4
};

// perturbs the current time by the time window * perturb_date
const perturbedTime = (): Date => {
  const time: number = new Date().getTime();
  const perturbAmount = config.get("server.storage.abuse_prevention.perturb_date");

  if (!perturbAmount) {
    return new Date(time);
  }

  const timeWindow: number = parseFloat(
    config.get("server.storage.abuse_prevention.time_window")
  );
  let upperOffset: number = (perturbAmount as number) * timeWindow * 1000;

  if (upperOffset < 30000) {
    upperOffset = 30000;
  }

  return new Date(Math.floor(time - upperOffset * Math.random()));
};

// perturbs the passed size by the allotment * perturb_size.
const perturbSize = (size: number): number => {
  const perturbAmount = config.get("server.storage.abuse_prevention.perturb_size");

  if (!perturbAmount) {
    return size;
  }

  const allotment: number = filesizeParser(
    config.get("server.storage.abuse_prevention.allotment")
  );
  let upperOffset: number = parseFloat(perturbAmount as string) * allotment;

  if (upperOffset < 1024*128) {
    upperOffset = 1024*128;
  }

  return Math.floor(size - upperOffset * Math.random());
};

// raw equation to calculate delay in seconds.
export const uploadDelay = (spaceUsed: number, allotment: number, pasteSize: number, delay: number): number => {
  const exponent = (spaceUsed - allotment) / (1024 * 1024);
  return (pasteSize / allotment) * Math.pow(delay, exponent);
};

// Calculate time to wait before uploading is allowed and return the milliseconds.
export const calculateUploadDelay = (uses: Usage[], size: number): number => {
  if (!config.get("server.storage.abuse_prevention.enabled")) {
    return 0;
  }

  const allotment = filesizeParser(config.get("server.storage.abuse_prevention.allotment"));
  const usedSpace = uses.reduce((acc, use) => acc + use.size, 0);

  if (usedSpace <= allotment) {
    return 0;
  }

  const delay = parseFloat(config.get("server.storage.abuse_prevention.delay_base"));
  return Math.floor(uploadDelay(usedSpace, allotment, size, delay) * 1000);
};

// Callback with whether an ip can upload and what their delay is.
export const canUpload = (ip: string, size: number, cb: (allowed: boolean, delay: number) => any): void => {
  const bucket = bucketIP(ip);

  Client
    .findOrCreate({ where: { bucket } })
    .spread((client: Client, created: boolean) => {
      if (created) {
        cb(true, 0);
      }

      Usage
        .findAll({
          where: {
            client: client.getKey(),
            createdAt: {
              [Op.gt]: new Date(
                new Date().getTime() - parseInt(config.get("server.storage.abuse_prevention.time_window"), 10) * 1000
              ),
            },
          },
          order: [["createdAt", "ASC"]],
        })
        .then((uses: Usage[]) => {
          if (uses.length === 0) {
            cb(true, 0);
          }
          const delay = calculateUploadDelay(uses, size)
          const lastUse: Date = uses[uses.length - 1].createdAt;
          const nextUpload = new Date(delay + lastUse.getTime());

          if (new Date() >= nextUpload) {
            cb(true, 0);
          } else {
            cb(false, nextUpload.getTime() - new Date().getTime());
          }
        });
    });
};

// IP is uploading something of size bytes at a time. Add offsets,
// bucket the IP, and store the usage.
export const addUpload = (ip: string, rawSize: number, cb: (use: Usage) => any): void => {
  const bucket = bucketIP(ip);
  const time = perturbedTime();
  const size: number = perturbSize(rawSize);
  Client
    .findOrCreate({ where: { bucket } })
    .spread((client: Client) => {
      Usage
        .create({ createdAt: time, size: size, client: client.getKey() })
        .then(cb)
        .catch(err => {
          console.error(`Error when creating usage:\n${err}`);
        });
    });
};

// Delete old usages. Since clients require bcrypt, these aren't
// deleted for now due to a performance hit.
export const cleanupLogs = () => {
  Usage.destroy({
    where: {
      createdAt: {
        [Op.lte]: new Date(
          new Date().getTime() - parseInt(config.get("server.storage.abuse_prevention.time_window"), 10) * 1000
        ),
      },
    }
  });
};

