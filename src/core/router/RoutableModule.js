// src/core/router/RoutableModule.js
import { CoreModule } from '../module/Module.js';
import { RouterError } from '../errors/types/RouterError.js';

/**
 * Extended CoreModule with routing capabilities
 * @extends CoreModule
 */
export class RoutableModule extends CoreModule {
  /**
   * Create a new RoutableModule
   * @param {Object} deps - Dependencies
   */
  constructor(deps) {
    super(deps);
    this.routes = [];
  }
  
  /**
   * Register a route with the router system
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {RoutableModule} - This instance
   */
  registerRoute(method, path, handler, options = {}) {
    if (!method || typeof method !== 'string') {
      throw new RouterError(
        'INVALID_METHOD',
        'Method must be a non-empty string'
      );
    }

    if (!path || typeof path !== 'string') {
      throw new RouterError(
        'INVALID_PATH',
        'Path must be a non-empty string'
      );
    }

    if (typeof handler !== 'function') {
      throw new RouterError(
        'INVALID_HANDLER',
        'Handler must be a function'
      );
    }
    
    // Store route for later registration
    this.routes.push({
      method: method.toUpperCase(),
      path,
      handler: handler.bind(this), // Bind to module instance
      options
    });
    
    // If we're already initialized, register immediately
    if (this.initialized) {
      this.registerRouteImmediately(method, path, handler, options);
    }
    
    // Record metric
    this.recordMetric('routes.registered', 1, {
      method: method.toUpperCase(),
      path
    });
    
    return this;
  }
  
  /**
   * Immediately register a route with the router system
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {Promise<void>}
   */
  async registerRouteImmediately(method, path, handler, options = {}) {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    await eventBus.emit('router.route.register', {
      moduleId: this.constructor.name,
      method: method.toUpperCase(),
      path,
      handler: handler.bind(this),
      options
    });
  }
  
  /**
   * Register a versioned route
   * @param {number} version - API version
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   * @param {Object} options - Route options
   * @returns {RoutableModule} - This instance
   */
  registerVersionedRoute(version, method, path, handler, options = {}) {
    const versionedPath = `/api/v${version}${path.startsWith('/') ? path : `/${path}`}`;
    return this.registerRoute(method, versionedPath, handler, {
      ...options,
      version
    });
  }
  
  /**
   * Register all routes with the router system
   * @returns {Promise<void>}
   */
  async registerAllRoutes() {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    for (const route of this.routes) {
      const { method, path, handler, options } = route;
      
      try {
        await eventBus.emit('router.route.register', {
          moduleId: this.constructor.name,
          method,
          path,
          handler,
          options
        });
      } catch (error) {
        await this.handleError(error, {
          method: 'registerAllRoutes',
          route: { method, path }
        });
      }
    }
    
    // Record metric
    this.recordMetric('routes.registered.batch', this.routes.length, {
      moduleId: this.constructor.name
    });
  }
  
  /**
   * Hook into initialization to register routes
   * @returns {Promise<void>}
   */
  async onInitialize() {
    // Setup health check for routes
    this.registerHealthCheck('routes', async () => {
      return { // line start 147
        status: 'healthy',
        count: this.routes.length,
        paths: this.routes.map(r => `${r.method} ${r.path}`) // line end 150
      };
    });
    
    // Register all routes
    await this.registerAllRoutes();
    
    // Continue with normal initialization
    await super.onInitialize();
  }
  
  /**
   * Unregister a route
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @returns {Promise<boolean>} - Whether route was unregistered
   */
  async unregisterRoute(method, path) {
    // Find route index
    const index = this.routes.findIndex(
      r => r.method === method.toUpperCase() && r.path === path
    );
    
    if (index === -1) {
      return false;
    }
    
    // Remove from local routes
    this.routes.splice(index, 1);
    
    // Signal router system to clear the route
    if (this.initialized) {
      const eventBus = this.deps.eventBusSystem.getEventBus();
      
      await eventBus.emit('router.route.unregister', {
        moduleId: this.constructor.name,
        method: method.toUpperCase(),
        path
      });
    }
    
    // Record metric
    this.recordMetric('routes.unregistered', 1, {
      method: method.toUpperCase(),
      path
    });
    
    return true;
  }
  
  /**
   * Hook into shutdown to clean up routes
   * @returns {Promise<void>}
   */
  async onShutdown() {
    // Clear routes if initialized
    if (this.initialized) {
      const eventBus = this.deps.eventBusSystem.getEventBus();
      
      // Unregister all routes from this module
      await eventBus.emit('router.module.unregister', {
        moduleId: this.constructor.name
      });
      
      // Clear local routes
      this.routes = [];
    }
    
    // Continue with normal shutdown
    await super.onShutdown();
  }
}

/**
 * Factory function for creating a RoutableModule
 * @param {Object} deps - Dependencies
 * @returns {RoutableModule} - RoutableModule instance
 */
export function createRoutableModule(deps = {}) {
  return new RoutableModule(deps);
}

export default {
  RoutableModule,
  createRoutableModule
};