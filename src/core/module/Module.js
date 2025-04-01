// src/core/module/Module.js
import { EventEmitter } from 'events';
import { CoreEventBus } from '../event/EventBus.js';
import { ModuleError, ValidationError } from '../errors/index.js';

export class CoreModule extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];
  static version = '1.0.0';
  
  constructor(deps = {}) {
    super();
    this.deps = deps;
    // Get the eventBus from eventBusSystem
    this.eventBus = deps.eventBusSystem?.getEventBus();
    this.initialized = false;
    this.config = deps.config || {};
    
    // Enhanced state tracking
    this.state = {
      status: 'created',
      startTime: null,
      errors: [],
      metrics: new Map(),
      healthChecks: new Map(),
      lastHealthCheck: null
    };

    // Validate dependencies immediately
    this.validateDependencies();
    
    // Set up health check interval
    this.healthCheckInterval = null;
  }

  validateDependencies() {
    // Check required dependencies
    const missing = this.constructor.dependencies.filter(
      dep => !this.deps[dep]
    );

    if (missing.length > 0) {
      throw new ModuleError(
        'MISSING_DEPENDENCIES',
        `Missing required dependencies: ${missing.join(', ')}`
      );
    }

    // Validate eventBusSystem dependency
    if (this.deps.eventBusSystem && typeof this.deps.eventBusSystem.getEventBus !== 'function') {
      throw new ModuleError(
        'INVALID_EVENTBUS_SYSTEM',
        'EventBusSystem missing required method: getEventBus'
      );
    }

    if (this.deps.errorSystem && typeof this.deps.errorSystem.handleError !== 'function') {
      throw new ModuleError(
        'INVALID_ERROR_SYSTEM',
        'ErrorSystem missing required methods'
      );
    }
  }

  async validateConfig() {
    try {
      // Basic config validation
      if (this.config === null || typeof this.config !== 'object') {
        throw new ValidationError(
          'INVALID_CONFIG',
          'Configuration must be an object'
        );
      }

      // Module-specific validation
      await this.onValidateConfig();
      
      return true;
    } catch (error) {
      throw new ModuleError(
        'CONFIG_VALIDATION_FAILED',
        'Failed to validate configuration',
        { originalError: error }
      );
    }
  }

  async initialize() {
    if (this.initialized) {
      throw new ModuleError(
        'ALREADY_INITIALIZED',
        'Module is already initialized'
      );
    }

    try {
      this.state.startTime = Date.now();
      this.state.status = 'initializing';

      // Configuration phase
      await this.validateConfig();
      await this.onConfigure();

      // Setup phase
      await this.setupEventHandlers();
      await this.setupHealthChecks();

      // Initialize phase
      await this.onInitialize();

      // Start health check monitoring
      this.startHealthChecks();
      
      this.initialized = true;
      this.state.status = 'running';

      await this.emit('module:initialized', {
        name: this.constructor.name,
        timestamp: new Date().toISOString()
      });

      return this;

    } catch (error) {
      this.state.status = 'error';
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message
      });

      throw new ModuleError(
        'INITIALIZATION_FAILED',
        'Failed to initialize module',
        { originalError: error }
      );
    }
  }

  async setupHealthChecks() {
    // Register default health checks
    this.registerHealthCheck('state', async () => {
      return {
        status: this.state.status === 'running' ? 'healthy' : 'unhealthy',
        uptime: Date.now() - this.state.startTime,
        errorCount: this.state.errors.length
      };
    });

    // Allow modules to add their own health checks
    await this.onSetupHealthChecks();
  }

  registerHealthCheck(name, checkFn) {
    if (typeof checkFn !== 'function') {
      throw new ModuleError(
        'INVALID_HEALTH_CHECK',
        `Health check ${name} must be a function`
      );
    }
    this.state.healthChecks.set(name, checkFn);
  }

  startHealthChecks() {
    // Run health checks every 30 seconds by default
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        this.state.lastHealthCheck = health;
        
        if (health.status !== 'healthy') {
          await this.handleError(new ModuleError(
            'HEALTH_CHECK_FAILED',
            'Module health check failed',
            { health }
          ));
        }
      } catch (error) {
        await this.handleError(error);
      }
    }, 30000);
  }

  async checkHealth() {
    const results = {};
    let overallStatus = 'healthy';

    for (const [name, checkFn] of this.state.healthChecks) {
      try {
        results[name] = await checkFn();
        if (results[name].status !== 'healthy') {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      name: this.constructor.name,
      version: this.constructor.version,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results
    };
  }

  async handleError(error, context = {}) {
    const safeContext = context || {};

    // Add error to state
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      context: safeContext
    });

    // Trim error history
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }

    // Forward to error system
    if (this.deps.errorSystem) {
      try {
        await this.deps.errorSystem.handleError(error, {
          module: this.constructor.name,
          ...safeContext
        });
      } catch (handlerError) {
        // Log error handling failure
        console.error('Error in error handling:', handlerError);
      }
    }

    // Emit error event
    await this.emit('module:error', {
      module: this.constructor.name,
      error,
      context: safeContext
    });

    return this;
  }

  async emit(eventName, ...args) {
    // Emit through local EventEmitter
    const localEmitResult = super.emit(eventName, ...args);

    // Broadcast through eventBus if available
    if (this.eventBus?.emit) {
      try {
        await this.eventBus.emit(eventName, ...args);
      } catch (error) {
        await this.handleError(error, {
          event: eventName,
          args
        });
      }
    }

    return localEmitResult;
  }

  async shutdown() {
    try {
      if (!this.initialized) {
        return this;
      }

      this.state.status = 'shutting_down';
      
      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Custom shutdown logic
      await this.onShutdown();
      
      // Reset state
      this.initialized = false;
      this.state.status = 'shutdown';
      this.state.startTime = null;
      
      await this.emit('module:shutdown', {
        name: this.constructor.name,
        timestamp: new Date().toISOString()
      });

      return this;
    } catch (error) {
      this.state.status = 'error';
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: 'shutdown' }
      });

      throw new ModuleError(
        'SHUTDOWN_FAILED',
        'Failed to shutdown module',
        { originalError: error }
      );
    }
  }

  // Lifecycle hooks for derived classes
  async onValidateConfig() {
    // Override in derived classes
    return true;
  }

  async onConfigure() {
    // Override in derived classes
    return Promise.resolve();
  }

  async setupEventHandlers() {
    // Override in derived classes
    return Promise.resolve();
  }

  async onSetupHealthChecks() {
    // Override in derived classes
    return Promise.resolve();
  }

  async onInitialize() {
    // Override in derived classes
    return Promise.resolve();
  }

  async onShutdown() {
    // Override in derived classes
    return Promise.resolve();
  }

  // Metrics tracking
  recordMetric(name, value, tags = {}) {
    this.state.metrics.set(name, {
      value,
      timestamp: Date.now(),
      tags
    });
  }
}

export function createModule(deps = {}) {
  const defaultDeps = {
    errorSystem: {
      handleError: async () => {} // No-op error handler
    },
    eventBusSystem: {
      getEventBus: () => new CoreEventBus({ // Use CoreEventBus instead of EventEmitter
        errorSystem: deps.errorSystem,
        config: deps.config
      })
    },
    config: {} // Empty configuration object
  };

  const mergedDeps = {
    ...defaultDeps,
    ...deps
  };

  return new CoreModule(mergedDeps);
}

export default {
  CoreModule,
  createModule
};