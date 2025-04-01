// src/core/module/ModuleSystem.js
import { EventEmitter } from 'events';
import { CoreModule } from './Module.js';
import { ModuleError, ValidationError } from '../errors/index.js';

export class ModuleSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];

  constructor(deps) {
    super();
    this.deps = deps;
    this.modules = new Map();
    this.initialized = false;
    // Get eventBus from eventBusSystem
    this.eventBus = deps.eventBusSystem?.getEventBus();
    this.state = {
      status: 'created',
      startTime: null,
      errors: [],
      metrics: new Map(),
      moduleHealth: new Map(),
      healthCheckIntervals: new Map() // Track intervals for proper cleanup
    };

    // Validate dependencies
    this.validateDependencies();
  }

  validateDependencies() {
    const missing = this.constructor.dependencies.filter(
      dep => !this.deps[dep]
    );

    if (missing.length > 0) {
      throw new ModuleError(
        'MISSING_DEPENDENCIES',
        `Missing required dependencies: ${missing.join(', ')}`
      );
    }

    // Validate eventBusSystem
    if (!this.deps.eventBusSystem?.getEventBus) {
      throw new ModuleError(
        'INVALID_EVENTBUS_SYSTEM',
        'EventBusSystem missing required methods'
      );
    }

    if (!this.deps.errorSystem?.handleError) {
      throw new ModuleError(
        'INVALID_ERROR_SYSTEM',
        'ErrorSystem missing required methods'
      );
    }
  }

  async emit(eventName, ...args) {
    // Local EventEmitter emission
    const localEmitResult = super.emit(eventName, ...args);
    
    // Use eventBus for global events if available
    if (this.eventBus?.emit) {
      try {
        await this.eventBus.emit(eventName, ...args);
      } catch (error) {
        await this.handleModuleError('ModuleSystem', error);
      }
    }
    
    return localEmitResult;
  }

  async register(name, ModuleClass, config = {}) {
    if (!(ModuleClass.prototype instanceof CoreModule)) {
      throw new ValidationError(
        'INVALID_MODULE',
        'Module must extend CoreModule'
      );
    }

    if (this.modules.has(name)) {
      throw new ModuleError(
        'DUPLICATE_MODULE',
        `Module ${name} is already registered`
      );
    }

    try {
      // Create module instance with dependencies
      const module = new ModuleClass({
        ...this.deps,
        config: {
          ...this.deps.config?.[name],
          ...config
        }
      });

      this.modules.set(name, module);

      // Setup health check listener
      module.on('module:error', async (error) => {
        await this.handleModuleError(name, error);
      });

      await this.emit('module:registered', {
        name,
        timestamp: new Date().toISOString()
      });

      return module;
    } catch (error) {
      throw new ModuleError(
        'REGISTRATION_FAILED',
        `Failed to register module ${name}`,
        { originalError: error }
      );
    }
  }

  async unregister(name) {
    const module = this.modules.get(name);
    if (!module) return;

    try {
      if (module.initialized) {
        await module.shutdown();
      }
      
      this.modules.delete(name);
      
      await this.emit('module:unregistered', {
        name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw new ModuleError(
        'UNREGISTER_FAILED',
        `Failed to unregister module ${name}`,
        { originalError: error }
      );
    }
  }

  async resolve(name) {
    const module = this.modules.get(name);
    if (!module) {
      throw new ModuleError(
        'MODULE_NOT_FOUND',
        `Module ${name} is not registered`
      );
    }
    return module;
  }

  async initialize() {
    if (this.initialized) {
      throw new ModuleError(
        'ALREADY_INITIALIZED',
        'ModuleSystem is already initialized'
      );
    }

    try {
      this.state.startTime = Date.now();
      this.state.status = 'initializing';

      // Initialize modules in dependency order
      const initOrder = this.resolveDependencyOrder();
      
      for (const name of initOrder) {
        const module = this.modules.get(name);
        await module.initialize();
        
        // Start monitoring module health
        await this.startModuleHealthMonitoring(name);
      }

      this.initialized = true;
      this.state.status = 'running';

      await this.emit('system:initialized', {
        timestamp: new Date().toISOString(),
        modules: Array.from(this.modules.keys())
      });

    } catch (error) {
      this.state.status = 'error';
      throw new ModuleError(
        'INITIALIZATION_FAILED',
        'Failed to initialize module system',
        { originalError: error }
      );
    }
  }

  resolveDependencyOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new ModuleError(
          'CIRCULAR_DEPENDENCY',
          `Circular dependency detected for module: ${name}`
        );
      }

      visiting.add(name);

      const module = this.modules.get(name);
      const deps = module.constructor.dependencies || [];

      for (const dep of deps) {
        if (!this.modules.has(dep)) {
          throw new ModuleError(
            'MISSING_DEPENDENCY',
            `Module ${name} requires missing module: ${dep}`
          );
        }
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.modules.keys()) {
      visit(name);
    }

    return order;
  }

  async startModuleHealthMonitoring(name) {
    const module = this.modules.get(name);
    if (!module) return;

    // Clear any existing interval
    if (this.state.healthCheckIntervals.has(name)) {
      clearInterval(this.state.healthCheckIntervals.get(name));
    }

    // Monitor module health status
    const intervalId = setInterval(async () => {
      try {
        const health = await module.checkHealth();
        this.state.moduleHealth.set(name, health);

        if (health.status !== 'healthy') {
          await this.handleModuleError(name, new ModuleError(
            'UNHEALTHY_MODULE',
            `Module ${name} is unhealthy`,
            { health }
          ));
        }
      } catch (error) {
        await this.handleModuleError(name, error);
      }
    }, 60000); // Check every minute

    // Track the interval for proper cleanup
    this.state.healthCheckIntervals.set(name, intervalId);
  }

  // async handleModuleError(moduleName, error) {
  //   this.state.errors.push({
  //     timestamp: new Date().toISOString(),
  //     module: moduleName,
  //     error: error.message
  //   });

  //   // Trim error history
  //   if (this.state.errors.length > 100) {
  //     this.state.errors.shift();
  //   }

  //   // Forward to error system
  //   try {
  //     if (this.deps.errorSystem?.handleError) {
  //       await this.deps.errorSystem.handleError(error, {
  //         source: 'ModuleSystem',
  //         module: moduleName
  //       });
  //     }
  //   } catch (handlerError) {
  //     // Log the error from the error system but don't rethrow
  //     console.error('Error in error handling:', handlerError);
  //   }
  //   await this.emit('module:error', {
  //     module: moduleName,
  //     error,
  //     timestamp: new Date().toISOString()
  //   });
  // }

  async handleModuleError(moduleName, error) {
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      module: moduleName,
      error: error.message
    });
  
    // Trim error history
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }
  
    // Defensive error handling for error system
    if (this.deps.errorSystem && typeof this.deps.errorSystem.handleError === 'function') {
      try {
        // Carefully forward error to error system with context
        await this.deps.errorSystem.handleError(error, {
          source: 'ModuleSystem',
          module: moduleName,
          timestamp: new Date().toISOString()
        });
      } catch (handlerError) {
        // Fallback logging mechanism
        const fallbackErrorLog = {
          timestamp: new Date().toISOString(),
          source: 'ModuleSystem',
          originalError: error.message,
          handlerError: handlerError.message,
          module: moduleName
        };
  
        // Use a robust logging mechanism
        if (typeof console.error === 'function') {
          console.error('Error System Failure:', JSON.stringify(fallbackErrorLog, null, 2));
        }
  
        // Optional: Add to local error tracking if error system fails
        this.state.errors.push({
          ...fallbackErrorLog,
          type: 'HANDLER_FAILURE'
        });
      }
    }
  
    // Emit error event regardless of error system status
    await this.emit('module:error', {
      module: moduleName,
      error,
      timestamp: new Date().toISOString()
    });
  }

  async getSystemHealth() {
    const moduleHealth = {};
    let systemStatus = 'healthy';

    for (const [name, module] of this.modules) {
      try {
        const health = await module.checkHealth();
        moduleHealth[name] = health;
        
        if (health.status !== 'healthy') {
          systemStatus = 'degraded';
        }
      } catch (error) {
        moduleHealth[name] = {
          status: 'error',
          error: error.message
        };
        systemStatus = 'unhealthy';
      }
    }

    return {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.state.startTime,
      modules: moduleHealth,
      errorCount: this.state.errors.length
    };
  }

  async shutdown() {
    if (!this.initialized) return;

    try {
      this.state.status = 'shutting_down';

      // Clear all health check intervals
      for (const [name, intervalId] of this.state.healthCheckIntervals) {
        clearInterval(intervalId);
      }
      this.state.healthCheckIntervals.clear();

      // Shutdown modules in reverse dependency order
      const shutdownOrder = this.resolveDependencyOrder().reverse();

      for (const name of shutdownOrder) {
        const module = this.modules.get(name);
        await module.shutdown();
      }

      this.modules.clear();
      this.initialized = false;
      this.state.status = 'shutdown';

      await this.emit('system:shutdown', {
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.state.status = 'error';
      throw new ModuleError(
        'SHUTDOWN_FAILED',
        'Failed to shutdown module system',
        { originalError: error }
      );
    }
  }
}

export function createModuleSystem(deps = {}) {
  const defaultDeps = {
    errorSystem: {
      handleError: async () => {} // No-op error handler
    },
    eventBusSystem: {
      getEventBus: () => new EventEmitter() // Default eventBus provider
    },
    config: {} // Empty configuration object
  };

  return new ModuleSystem({
    ...defaultDeps,
    ...deps
  });
}

export default {
  ModuleSystem,
  createModuleSystem
};