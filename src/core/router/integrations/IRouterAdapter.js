// src/core/router/integrations/IRouterAdapter.js

/**
 * Interface for framework adapters
 */
export class IRouterAdapter {
    /**
     * Apply routes to a framework
     * @param {Object} framework - HTTP framework instance
     * @param {Array} routes - Array of route objects
     * @returns {Promise<Object>} - Framework instance with routes applied
     */
    async applyRoutes(framework, routes) {
      throw new Error('applyRoutes() must be implemented');
    }
  }
  
  export default IRouterAdapter;