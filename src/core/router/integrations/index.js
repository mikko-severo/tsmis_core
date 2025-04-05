// src/core/router/integrations/index.js
import { IRouterAdapter } from './IRouterAdapter.js';
import { FastifyAdapter } from './fastify/index.js';
import { ExpressAdapter } from './express/index.js';

export {
  IRouterAdapter,
  FastifyAdapter,
  ExpressAdapter
};

export default {
  IRouterAdapter,
  FastifyAdapter,
  ExpressAdapter
};