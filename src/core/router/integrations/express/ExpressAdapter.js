// src/core/router/integrations/express/ExpressAdapter.js
import { IRouterAdapter } from '../IRouterAdapter.js';

/**
 * Express adapter for router system
 * @extends IRouterAdapter
 */
export class ExpressAdapter extends IRouterAdapter {
  /**
   * Apply routes to Express
   * @param {Object} app - Express app instance
   * @param {Array} routes - Array of route objects
   * @returns {Promise<Object>} - Express app with routes applied
   */
  async applyRoutes(app, routes) {
    if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
      throw new Error('Invalid Express app instance');
    }

    for (const route of routes) {
      const { method, path, handler, options = {} } = route;
      
      // Extract Express-specific middleware
      const middleware = options.middleware || [];
      
      // Get the HTTP method function (lowercase)
      const methodFn = method.toLowerCase();
      
      if (typeof app[methodFn] !== 'function') {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }
      
      // Register the route with Express
      // Wrap the handler to normalize the response format
      app[methodFn](path, ...middleware, this.wrapHandler(handler));
    }
    
    return app;
  }

  /**
   * Wrap a handler for Express compatibility
   * @param {Function} handler - Original handler
   * @returns {Function} - Wrapped handler
   */
  wrapHandler(handler) {
    return async (req, res, next) => {
      try {
        // Call the original handler
        const result = await handler(req, res);
        
        // If headers already sent, the handler took care of the response
        if (!res.headersSent) {
          res.json(result);
        }
      } catch (error) {
        next(error);
      }
    };
  }
}

export default ExpressAdapter;