// src/core/router/integrations/fastify/FastifyAdapter.js
import { IRouterAdapter } from '../IRouterAdapter.js';

/**
 * Fastify adapter for router system
 * @extends IRouterAdapter
 */
export class FastifyAdapter extends IRouterAdapter {
  /**
   * Apply routes to Fastify
   * @param {Object} fastify - Fastify instance
   * @param {Array} routes - Array of route objects
   * @returns {Promise<Object>} - Fastify instance with routes applied
   */
  async applyRoutes(fastify, routes) {
    if (!fastify || typeof fastify.route !== 'function') {
      throw new Error('Invalid Fastify instance');
    }

    for (const route of routes) {
      const { method, path, handler, options = {} } = route;
      
      // Extract Fastify-specific options
      const {
        schema = {},
        middleware = [],
        ...fastifyOptions
      } = options.fastify || {};

      // Prepare the Fastify route configuration
      const routeConfig = {
        method,
        url: path,
        schema,
        ...fastifyOptions
      };

      // Add any middleware as preHandler hooks
      if (middleware.length > 0) {
        routeConfig.preHandler = middleware;
      }

      // Set handler with proper this binding if it's a method
      routeConfig.handler = handler;

      // Register the route with Fastify
      fastify.route(routeConfig);
    }
    
    return fastify;
  }
}

export default FastifyAdapter;