import { Application } from "express";

import corsMiddleware from "./cors";
import { jsonParser, rawParser, urlEncodedParser } from "./parsers";
import errorHandler from "./errors";


const applyMiddleware = (app: Application): void => {
  app.use(corsMiddleware);
  app.use(rawParser);
  app.use(jsonParser);
  app.use(urlEncodedParser);
  app.use(errorHandler);
};

export default applyMiddleware;
