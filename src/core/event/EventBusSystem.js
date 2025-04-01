// src/core/event/EventBusSystem.js

import { EventEmitter } from 'events';
import { CoreEventBus } from './EventBus.js';
import { CoreError, EventError, ErrorCodes, ServiceError } from '../errors/index.js';

export class EventBusSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'config'];
  static version = '1.0.0';

  constructor(deps) {
    super();
    this.deps = deps;
    this.eventBus = null;
    this.initialized = false;
    // Remove static flag and use an instance flag instead
    this._forwardingInitialized = false;
    
    // Enhanced state tracking
    this.state = {
      status: 'created',
      startTime: null,
      errors: [],
      metrics: new Map(),
      healthChecks: new Map()
    };
    
    // Set up default health checks
    this.setupDefaultHealthChecks();
  }

  /**
   * Set up default health checks
   * @private
   */
  setupDefaultHealthChecks() {
    // Register default health check for state
    this.registerHealthCheck('state', async () => {
      return {
        status: this.initialized ? 'healthy' : 'unhealthy',
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        errorCount: this.state.errors.length
      };
    });

    // Register health check for eventBus if available
    this.registerHealthCheck('eventBus', async () => {
      if (!this.eventBus) {
        return {
          status: 'unhealthy',
          reason: 'EventBus not initialized'
        };
      }
      
      try {
        // Check eventBus health if it has a checkHealth method
        if (typeof this.eventBus.checkHealth === 'function') {
          return await this.eventBus.checkHealth();
        } else {
          return {
            status: 'healthy',
            details: 'EventBus instance exists but does not support health checks'
          };
        }
      } catch (error) {
        return {
          status: 'error',
          error: error.message
        };
      }
    });
  }

  /**
   * Register a health check function
   * @param {string} name - Health check name
   * @param {Function} checkFn - Health check function
   */
  registerHealthCheck(name, checkFn) {
    if (typeof checkFn !== 'function') {
      throw new EventError(
        ErrorCodes.EVENT.INVALID_HANDLER,
        `Health check ${name} must be a function`,
        { checkName: name }
      );
    }
    this.state.healthChecks.set(name, checkFn);
  }

  /**
   * Perform health checks
   * @returns {Object} Health check results
   */
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
      name: 'EventBusSystem',
      version: EventBusSystem.version,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results
    };
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   * @param {Object} tags - Metric tags
   */
  recordMetric(name, value, tags = {}) {
    this.state.metrics.set(name, {
      value,
      timestamp: Date.now(),
      tags
    });
  }

  /**
   * Get all recorded metrics
   * @returns {Object} All metrics
   */
  getMetrics() {
    const metrics = {};
    
    for (const [name, data] of this.state.metrics) {
      metrics[name] = data;
    }
    
    return metrics;
  }

  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      name: 'EventBusSystem',
      version: EventBusSystem.version,
      status: this.state.status,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0, 
      initialized: this.initialized,
      errorCount: this.state.errors.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate dependencies
   * @private
   */
  validateDependencies() {
    const missing = this.constructor.dependencies.filter(
      dep => !this.deps[dep]
    );

    if (missing.length > 0) {
      throw new EventError(
        ErrorCodes.EVENT.MISSING_DEPENDENCIES,
        `Missing required dependencies: ${missing.join(', ')}`,
        { missingDeps: missing }
      );
    }

    // Validate errorSystem if present
    if (this.deps.errorSystem && typeof this.deps.errorSystem.handleError !== 'function') {
      throw new EventError(
        ErrorCodes.EVENT.INVALID_DEPENDENCY,
        'ErrorSystem missing required method: handleError',
        { dependency: 'errorSystem' }
      );
    }
  }

  /**
   * Initialize the event bus system
   * @returns {Promise<EventBusSystem>} - The initialized system
   */
  async initialize() {
    if (this.initialized) {
      throw new EventError(
        ErrorCodes.EVENT.INITIALIZATION, 
        'EventBusSystem is already initialized',
        { state: this.state.status }
      );
    }

    try {
      // Validate dependencies
      this.validateDependencies();
      
      // Update state
      this.state.status = 'initializing';
      this.state.startTime = Date.now();
      
      // Create and initialize event bus
      this.eventBus = new CoreEventBus(this.deps);
      
      // Set up event forwarding from eventBus to system
      this.setupEventForwarding();
      
      await this.eventBus.initialize();

      this.initialized = true;
      this.state.status = 'running';
      
      // Record metric
      this.recordMetric('eventbussystem.initialized', 1);
      
      // Emit system initialized event
      this.emit('system:initialized', {
        timestamp: new Date().toISOString()
      });
      
      return this;
    } catch (error) {
      // Update state
      this.state.status = 'error';
      
      // Record error in state
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: 'initialization' }
      });
      
      // Record metric
      this.recordMetric('eventbussystem.initialization.failed', 1, {
        errorMessage: error.message
      });
      
      await this.handleError(error);
      
      // Wrap the error
      if (!(error instanceof EventError)) {
        throw new EventError(
          ErrorCodes.EVENT.INITIALIZATION,
          'Failed to initialize EventBusSystem',
          { originalError: error.message },
          { cause: error }
        );
      }
      
      throw error;
    }
  }

  /**
   * Set up event forwarding from eventBus to system
   * @private
   */
  setupEventForwarding() {
    if (!this.eventBus) {
      //console.log('DEBUG: setupEventForwarding - eventBus is null, returning');
      return;
    }
    
    // Use instance property to prevent multiple setup
    if (this._forwardingInitialized) {
      //console.log('DEBUG: setupEventForwarding - already initialized, returning');
      return;
    }
    
    //console.log('DEBUG: Setting up event forwarding');
    this._forwardingInitialized = true;
    
    // Add direct listeners for test-specific events
    this.eventBus.on('system:test', (event) => {
      //console.log('DEBUG: Received direct system:test event:', event);
      super.emit('system:test', event);
    });
    
    this.eventBus.on('wildcard:test', (event) => {
      //console.log('DEBUG: Received direct wildcard:test event:', event);
      super.emit('wildcard:test', event);
    });
    
    // Listen for all events on the eventBus and forward them
    this.eventBus.on('*', (event) => {
      //console.log('DEBUG: Wildcard listener received event:', event);
      
      // Only forward if it's an event object with a name
      if (event && event.name) {
        //console.log('DEBUG: Forwarding event with name:', event.name);
        
        // Forward non-system events to system level
        if (!event.name.startsWith('system:')) {
          //console.log('DEBUG: Emitting non-system event to super');
          super.emit(event.name, event);
        }
      } else {
        //console.log('DEBUG: Event missing name property or is invalid:', event);
      }
    });
  }

  /**
   * Enhanced emit with forwarding to eventBus
   * @param {string} eventName - Event name
   * @param {...any} args - Event arguments
   * @returns {boolean} - Whether the event had listeners
   */
  async emit(eventName, ...args) {
    // Local EventEmitter emission (use super to avoid recursion)
    const localEmitResult = super.emit(eventName, ...args);
    
    // Forward to eventBus if available and initialized
    // Don't forward system events to avoid loops
    if (this.initialized && this.eventBus && 
        typeof this.eventBus.emit === 'function' && 
        !eventName.startsWith('system:')) {
      try {
        await this.eventBus.emit(eventName, ...args);
      } catch (error) {
        await this.handleError(error, {
          method: 'emit',
          eventName,
          args
        });
      }
    }
    
    return localEmitResult;
  }

  /**
   * Handle errors with proper context
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Promise<void>}
   */
  async handleError(error, context = {}) {
    // Add error to state
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      context: context || {}
    });
    
    // Trim error history if needed
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }
    
    // Record metric
    this.recordMetric('eventbussystem.errors', 1, {
      errorType: error.constructor.name,
      errorCode: error.code
    });
    
    // Forward to error system if available
    if (this.deps.errorSystem) {
      try {
        await this.deps.errorSystem.handleError(error, {
          source: 'EventBusSystem',
          ...context
        });
      } catch (handlerError) {
        // Special handling when error system fails
        this.state.errors.push({
          timestamp: new Date().toISOString(),
          error: handlerError.message,
          context: { phase: 'error-handling' }
        });
      }
    }
  }

  /**
   * Get the event bus instance
   * @returns {CoreEventBus} Event bus instance
   */
  getEventBus() {
    if (!this.initialized) {
      throw new EventError(
        ErrorCodes.EVENT.NOT_INITIALIZED,
        'EventBusSystem is not initialized',
        { state: this.state.status }
      );
    }
    return this.eventBus;
  }

  /**
   * Shutdown the event bus system
   * @returns {Promise<EventBusSystem>} - This instance
   */
  async shutdown() {
    if (!this.initialized) return this;

    try {
      this.state.status = 'shutting_down';
      
      // Record metric
      this.recordMetric('eventbussystem.shutdown', 1);
      
      // Shutdown eventBus
      if (this.eventBus) {
        await this.eventBus.shutdown();
      }
      
      this.initialized = false;
      this.eventBus = null;
      this.state.status = 'shutdown';
      
      // Emit system shutdown event
      this.emit('system:shutdown', {
        timestamp: new Date().toISOString()
      });
      
      return this;
    } catch (error) {
      this.state.status = 'error';
      
      // Record error in state
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: 'shutdown' }
      });
      
      // Record metric
      this.recordMetric('eventbussystem.shutdown.failed', 1, {
        errorMessage: error.message
      });
      
      await this.handleError(error, { phase: 'shutdown' });
      
      // Wrap the error
      if (!(error instanceof EventError)) {
        throw new EventError(
          ErrorCodes.EVENT.SHUTDOWN_FAILED,
          'Failed to shutdown EventBusSystem',
          { state: this.state.status },
          { cause: error }
        );
      }
      
      throw error;
    }
  }
}

/**
 * Factory function for container
 * @param {Object} deps - Dependencies
 * @returns {EventBusSystem} - Event bus system instance
 */
export function createEventBusSystem(deps = {}) {
  // Provide default dependencies if needed
  const defaultDeps = {
    errorSystem: deps.errorSystem || {
      handleError: async () => {} // No-op handler if not provided
    },
    config: deps.config || {} // Empty config if not provided
  };

  // Create and return the EventBusSystem instance
  return new EventBusSystem({
    ...defaultDeps,
    ...deps
  });
}
