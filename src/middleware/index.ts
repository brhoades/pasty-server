import { Application } from "express";

import abusePrevention from "./abuse";
import corsMiddleware from "./cors";
import { jsonParser, rawParser, urlEncodedParser } from "./parsers";
import errorHandler from "./errors";


const applyMiddleware = (app: Application): void => {
  app.use(corsMiddleware);
  app.use(rawParser);
  app.use(jsonParser);
  app.use(urlEncodedParser);
  app.use(errorHandler);
  app.use('/paste', abusePrevention);
};

export default applyMiddleware;
