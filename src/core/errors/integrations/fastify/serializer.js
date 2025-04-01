import { fastifyErrorHandler } from './handler.js';

export const errorSerializer = {
  serializer: (error) => fastifyErrorHandler.serializeError(error)
};