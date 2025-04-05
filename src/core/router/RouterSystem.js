// src/core/router/RouterSystem.js
import { CoreRouter }

/**
 * Factory function for creating a RouterSystem
 * @param {Object} deps - Dependencies
 * @returns {RouterSystem} - RouterSystem instance
 */
export function createRouterSystem(deps = {}) {
  // Provide default dependencies if needed
  const defaultDeps = {
    errorSystem: deps.errorSystem || {
      handleError: async () => {} // No-op handler if not provided
    },
    eventBusSystem: deps.eventBusSystem,
    config: deps.config || {} // Empty config if not provided
  };

  // Create and return the RouterSystem instance
  return new RouterSystem({
    ...defaultDeps,
    ...deps
  });
}

export default {
  RouterSystem,
  createRouterSystem
}; from './Router.js';
import { RouterError } from '../errors/types/RouterError.js';

/**
 * Router system for centralized route management
 */
export class RouterSystem {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];

  /**
   * Create a new RouterSystem
   * @param {Object} deps - Dependencies
   */
  constructor(deps) {
    this.deps = deps;
    this.router = null;
    this.initialized = false;
  }

  /**
   * Initialize the router system
   * @returns {Promise<RouterSystem>} - This instance
   */
  async initialize() {
    if (this.initialized) {
      throw new RouterError(
        'ALREADY_INITIALIZED',
        'RouterSystem is already initialized'
      );
    }

    try {
      // Create and initialize the router
      this.router = new CoreRouter(this.deps);
      await this.router.initialize();
      
      this.initialized = true;
      return this;
    } catch (error) {
      if (this.deps.errorSystem) {
        await this.deps.errorSystem.handleError(error, {
          source: 'RouterSystem',
          method: 'initialize'
        });
      }
      
      throw new RouterError(
        'INITIALIZATION_FAILED',
        'Failed to initialize RouterSystem',
        { originalError: error.message },
        { cause: error }
      );
    }
  }

  /**
   * Get the router instance
   * @returns {CoreRouter} - Router instance
   */
  getRouter() {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router;
  }

  /**
   * Register a route
   * @param {string} moduleId - Module ID
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {RouterSystem} - This instance
   */
  registerRoute(moduleId, method, path, handler, options = {}) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    this.router.registerRoute(moduleId, method, path, handler, options);
    return this;
  }

  /**
   * Register a versioned route
   * @param {string} moduleId - Module ID
   * @param {number} version - API version
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {RouterSystem} - This instance
   */
  registerVersionedRoute(moduleId, version, method, path, handler, options = {}) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    this.router.registerVersionedRoute(moduleId, version, method, path, handler, options);
    return this;
  }

  /**
   * Register an adapter
   * @param {string} name - Adapter name
   * @param {Object} adapter - Adapter implementation
   * @returns {RouterSystem} - This instance
   */
  registerAdapter(name, adapter) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    this.router.registerAdapter(name, adapter);
    return this;
  }

  /**
   * Register middleware
   * @param {string} name - Middleware name
   * @param {Function} handler - Middleware handler
   * @param {Object} options - Middleware options
   * @returns {RouterSystem} - This instance
   */
  registerMiddleware(name, handler, options = {}) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    this.router.registerMiddleware(name, handler, options);
    return this;
  }

  /**
   * Apply routes to a framework using the specified adapter
   * @param {Object} framework - HTTP framework instance
   * @param {string} adapterName - Adapter name
   * @returns {Promise<Object>} - Framework with routes applied
   */
  async applyRoutes(framework, adapterName) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return await this.router.applyRoutes(framework, adapterName);
  }

  /**
   * Get all registered routes
   * @returns {Array} - Array of route objects
   */
  getRoutes() {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router.getRoutes();
  }

  /**
   * Get a specific route by method and path
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {Object|null} - Route object or null if not found
   */
  getRoute(method, path) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router.getRoute(method, path);
  }

  /**
   * Get routes for a specific module
   * @param {string} moduleId - Module ID
   * @returns {Array} - Array of route objects
   */
  getModuleRoutes(moduleId) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router.getModuleRoutes(moduleId);
  }

  /**
   * Unregister a route
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {boolean} - Whether the route was unregistered
   */
  unregisterRoute(method, path) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router.unregisterRoute(method, path);
  }

  /**
   * Unregister all routes for a module
   * @param {string} moduleId - Module ID
   * @returns {number} - Number of routes unregistered
   */
  unregisterModuleRoutes(moduleId) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router.unregisterModuleRoutes(moduleId);
  }

  /**
   * Clear all routes
   * @returns {RouterSystem} - This instance
   */
  clearRoutes() {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    this.router.clearRoutes();
    return this;
  }

  /**
   * Generate OpenAPI documentation from routes
   * @param {Object} info - API info
   * @returns {Object} - OpenAPI document
   */
  generateOpenApiDoc(info = {}) {
    if (!this.initialized) {
      throw new RouterError(
        'NOT_INITIALIZED',
        'RouterSystem is not initialized'
      );
    }
    
    return this.router.generateOpenApiDoc(info);
  }

  /**
   * Get health status
   * @returns {Promise<Object>} - Health status
   */
  async checkHealth() {
    if (!this.initialized) {
      return {
        name: 'RouterSystem',
        status: 'unhealthy',
        reason: 'Not initialized',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      const routerHealth = await this.router.checkHealth();
      return {
        name: 'RouterSystem',
        status: routerHealth.status,
        timestamp: new Date().toISOString(),
        details: routerHealth
      };
    } catch (error) {
      return {
        name: 'RouterSystem',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Shutdown the router system
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) return;
    
    try {
      await this.router.shutdown();
      this.initialized = false;
      this.router = null;
    } catch (error) {
      if (this.deps.errorSystem) {
        await this.deps.errorSystem.handleError(error, {
          source: 'RouterSystem',
          method: 'shutdown'
        });
      }
      
      throw new RouterError(
        'SHUTDOWN_FAILED',
        'Failed to shutdown RouterSystem',
        { originalError: error.message },
        { cause: error }
      );
    }
  }
}