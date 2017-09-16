import { generate as generate } from "shortid";


// Generates a random id of the provided length.
const generateId = (len: number = 7): string => {
  let id: string = "";

  while (id.length < len) {
    id += generate();
  }

  if (id.length > len) {
    return id.substr(0, len);
  }

  return id;
};

export default generateId;
