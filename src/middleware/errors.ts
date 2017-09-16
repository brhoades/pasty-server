import { ErrorRequestHandler, NextFunction, Request, Response} from "express";

import { error, tooLargeError } from "../lib/responses";


const errorHandler: ErrorRequestHandler = (err, req, res, next): void => {
  if (err.status === 413) {
    res.json(tooLargeError(err.length));
    return;
  }

  if (err.status === 500) {
    res.json(error("Unknown internal server error"));
    return;
  }

  next();
};

export default errorHandler;
