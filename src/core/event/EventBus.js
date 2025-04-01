// src/core/event/EventBus.js

import { EventEmitter } from "events";
import { CoreError, EventError, ErrorCodes } from "../errors/index.js";

export class CoreEventBus extends EventEmitter {
  static dependencies = ["errorSystem", "config"];
  static version = "1.0.0";

  constructor(deps = {}) {
    super();
    this.deps = deps;
    this.queues = new Map();
    this.subscriptions = new Map();
    this.history = new Map();
    this.maxHistorySize = deps.config?.eventHistory?.maxSize || 1000;
    this.initialized = false;

    // Enhanced state tracking
    this.state = {
      status: "created",
      startTime: null,
      metrics: new Map(),
      errors: [],
      healthChecks: new Map(),
    };

    // Set up health check function map
    this.setupDefaultHealthChecks();
  }

  /**
   * Set up default health checks
   * @private
   */
  setupDefaultHealthChecks() {
    // Register default health check for state
    this.registerHealthCheck("state", async () => {
      return {
        status: this.initialized ? "healthy" : "unhealthy",
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        errorCount: this.state.errors.length,
      };
    });

    // Register health check for event queues
    this.registerHealthCheck("queues", async () => {
      const queueCounts = {};
      let totalQueuedEvents = 0;

      this.queues.forEach((queue, key) => {
        queueCounts[key] = queue.length;
        totalQueuedEvents += queue.length;
      });

      return {
        status: "healthy",
        queueCount: this.queues.size,
        totalQueuedEvents,
        queues: queueCounts,
      };
    });

    // Register health check for subscriptions
    this.registerHealthCheck("subscriptions", async () => {
      return {
        status: "healthy",
        count: this.subscriptions.size,
        patterns: Array.from(this.subscriptions.values()).map((s) => s.pattern),
      };
    });
  }

  /**
   * Register a health check function
   * @param {string} name - Health check name
   * @param {Function} checkFn - Health check function
   */
  registerHealthCheck(name, checkFn) {
    if (typeof checkFn !== "function") {
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
    let overallStatus = "healthy";

    for (const [name, checkFn] of this.state.healthChecks) {
      try {
        results[name] = await checkFn();
        if (results[name].status !== "healthy") {
          overallStatus = "unhealthy";
        }
      } catch (error) {
        results[name] = {
          status: "error",
          error: error.message,
        };
        overallStatus = "unhealthy";
      }
    }

    return {
      name: "CoreEventBus",
      version: CoreEventBus.version,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
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
      tags,
    });
  }

  /**
   * Set up wildcard event forwarding
   * @private
   */
  setupWildcardForwarding() {
    // Only set up once
    if (this._originalEmit) return;

    // Store original emit
    this._originalEmit = this.emit;

    // Create new emit function with wildcard forwarding
    this.emit = function (eventName, data, options = {}) {
      // Call original emit for regular event
      const result = this._originalEmit.call(this, eventName, data, options);

      // Forward to wildcard handlers with correct parameters
      if (eventName !== "*") {
        this._originalEmit.call(this, "*", eventName, data);
      }

      return result;
    }.bind(this);

    // Log and record metric
    //console.log('Wildcard event forwarding enabled');
    this.recordMetric("eventbus.wildcard.enabled", 1);

    return true;
  }

  /**
   * Remove wildcard event forwarding
   * @private
   */
  removeWildcardForwarding() {
    if (!this._originalEmit) return;

    // Restore original emit
    this.emit = this._originalEmit;
    this._originalEmit = null;

    // Log and record metric
    //console.log('Wildcard event forwarding disabled');
    this.recordMetric("eventbus.wildcard.disabled", 1);

    return true;
  }

  async initialize() {
    if (this.initialized) {
      throw new EventError(
        ErrorCodes.EVENT.INITIALIZATION_FAILED,
        "EventBus is already initialized",
        { state: this.state.status }
      );
    }

    try {
      // Initialize event tracking
      this.state.status = "initializing";
      this.state.startTime = Date.now();

      // Set up newListener handler for wildcard support
      this.on("newListener", (event, listener) => {
        // Guard against recursion
        if (this._processingNewListener) return;
        this._processingNewListener = true;

        try {
          // Handle event being an object or string
          const eventName =
            typeof event === "string"
              ? event
              : event && event.toString
              ? event.toString()
              : String(event);

          // Set up wildcard forwarding when first '*' listener is added
          if (eventName === "*") {
            this.setupWildcardForwarding();
          }
        } finally {
          this._processingNewListener = false;
        }
      });

      // Clean up wildcard support when all "*" listeners are removed
      this.on("removeListener", (event) => {
        if (event === "*" && this.listenerCount("*") === 0) {
          this.removeWildcardForwarding();
        }
      });

      this.initialized = true;
      this.state.status = "running";
      this.emit("system:initialized", {
        timestamp: new Date().toISOString(),
      });

      this.recordMetric("eventbus.initialized", 1);
    } catch (error) {
      this.state.status = "error";
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
      });
      await this.handleError(error);

      throw new EventError(
        ErrorCodes.EVENT.INITIALIZATION,
        "Failed to initialize EventBus",
        { originalError: error.message },
        { cause: error }
      );
    }
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
      context: context || {},
    });

    // Trim error history if needed
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }

    // Record metric
    this.recordMetric("eventbus.errors", 1, {
      errorType: error.constructor.name,
      errorCode: error.code,
    });

    // Forward to error system if available
    if (this.deps.errorSystem) {
      await this.deps.errorSystem.handleError(error, {
        source: "CoreEventBus",
        ...context,
      });
    }
  }

  /**
   * Enhanced emit with queuing, history, and pattern matching
   * @param {string} eventName - Event name
   * @param {*} data - Event data
   * @param {Object} options - Emission options
   * @returns {boolean} - Whether the event had listeners
   */
  async emit(eventName, data, options = {}) {
    try {
      if (!eventName || typeof eventName !== "string") {
        throw new EventError(
          ErrorCodes.EVENT.INVALID_EVENT_NAME,
          "Event name must be a non-empty string",
          { providedEventName: eventName }
        );
      }

      const event = {
        id: crypto.randomUUID(),
        name: eventName,
        data,
        timestamp: new Date().toISOString(),
        metadata: options.metadata || {},
      };

      // Store in history
      this.trackEvent(event);

      // Record metric
      this.recordMetric("eventbus.events.emitted", 1, {
        eventName,
        queued: Boolean(options.queue),
      });

      // Handle queuing if needed
      if (options.queue) {
        return this.queueEvent(event, options);
      }

      // Normal event emission
      return super.emit(eventName, event);
    } catch (error) {
      await this.handleError(error, {
        eventName,
        data,
        options,
      });

      // Wrap original error
      if (!(error instanceof EventError)) {
        throw new EventError(
          ErrorCodes.EVENT.EMISSION_FAILED,
          `Failed to emit event: ${eventName}`,
          { eventName, options },
          { cause: error }
        );
      }

      throw error;
    }
  }

  /**
   * Enhanced subscription with pattern matching support
   * @param {string} pattern - Event pattern (supports * wildcard)
   * @param {Function} handler - Event handler
   * @param {Object} options - Subscription options
   * @returns {string} - Subscription ID
   */
  subscribe(pattern, handler, options = {}) {
    try {
      // Validate pattern
      if (!pattern || typeof pattern !== "string") {
        throw new EventError(
          ErrorCodes.EVENT.INVALID_PATTERN,
          "Event pattern must be a non-empty string",
          { providedPattern: pattern }
        );
      }

      // Validate handler
      if (typeof handler !== "function") {
        throw new EventError(
          ErrorCodes.EVENT.INVALID_HANDLER,
          "Event handler must be a function",
          { pattern }
        );
      }

      const subscription = {
        id: crypto.randomUUID(),
        pattern,
        handler,
        options,
        created: new Date().toISOString(),
      };

      this.subscriptions.set(subscription.id, subscription);

      // Handle different subscription types
      if (!pattern.includes("*")) {
        // Direct pattern match (no wildcards)
        this.on(pattern, handler);
      } else if (pattern === "*") {
        // Wildcard pattern - matches all events
        // We need to adapt the handler to handle our new parameter format
        const adaptedHandler = (eventName, data) => handler(data);
        this.on("*", adaptedHandler);
        subscription.adaptedHandler = adaptedHandler; // Store for unsubscribe
      } else {
        // RegexPatern
        const regexPattern = new RegExp(
          "^" + pattern.replace(/\*/g, ".*") + "$"
        );
        // Segment wildcard patterns (e.g., 'user.*', '*.created')
        // This also needs to be updated for the new parameter format
        const patternHandler = (eventName, data) => {
          if (regexPattern.test(eventName)) {
            handler(data);
          }
        };
        this.on("*", patternHandler);
        subscription.patternHandler = patternHandler;
      }
      // Record metric
      this.recordMetric("eventbus.subscriptions", 1, {
        pattern,
      });

      return subscription.id;
    } catch (error) {
      this.handleError(error, {
        method: "subscribe",
        pattern,
        options,
      });

      // Wrap original error
      if (!(error instanceof EventError)) {
        throw new EventError(
          ErrorCodes.EVENT.SUBSCRIPTION_FAILED,
          `Failed to subscribe to pattern: ${pattern}`,
          { pattern, options },
          { cause: error }
        );
      }

      throw error;
    }
  }

  /**
   * Unsubscribe from events
   * @param {string} subscriptionId - Subscription ID
   * @returns {boolean} - Whether the subscription was removed
   */
  unsubscribe(subscriptionId) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new EventError(
          ErrorCodes.EVENT.HANDLER_NOT_FOUND,
          `Subscription ${subscriptionId} not found`,
          { subscriptionId }
        );
      }

      const { pattern, handler, patternHandler, adaptedHandler } = subscription;

      // Remove the appropriate handler
      // Original code
      // if (!pattern.includes("*")) {
      //   this.removeListener(pattern, handler);
      // } else if (pattern === "*") {
      //   // Use adaptedHandler if available
      //   /* istanbul ignore next */
      //   this.removeListener("*", adaptedHandler || handler);
      // } else if (patternHandler) {
      //   this.removeListener("*", patternHandler);
      // }
      if (!pattern.includes("*")) {
        this.removeListener(pattern, handler);
      }
      /* istanbul ignore next */
      if (pattern === '*') {
        this.removeListener('*', adaptedHandler || handler);
      }

      if (patternHandler) {
        this.removeListener("*", patternHandler); // ← now line 464
      }

      // Remove from subscriptions map
      this.subscriptions.delete(subscriptionId);

      // Record metric
      this.recordMetric("eventbus.unsubscriptions", 1, {
        pattern,
      });

      return true;
    } catch (error) {
      this.handleError(error, {
        method: "unsubscribe",
        subscriptionId,
      });

      // Wrap original error
      if (!(error instanceof EventError)) {
        throw new EventError(
          ErrorCodes.EVENT.SUBSCRIPTION_FAILED,
          `Failed to unsubscribe: ${subscriptionId}`,
          { subscriptionId },
          { cause: error }
        );
      }

      throw error;
    }
  }

  /**
   * Queue events for delayed processing
   * @param {Object} event - Event object
   * @param {Object} options - Queue options
   * @returns {Promise<boolean>} - Whether the event was queued
   */
  async queueEvent(event, options = {}) {
    try {
      const queue = this.queues.get(event.name) || [];
      const queueItem = {
        event,
        options,
        timestamp: new Date().toISOString(),
      };

      queue.push(queueItem);
      this.queues.set(event.name, queue);

      // Record metric
      this.recordMetric("eventbus.queued", 1, {
        eventName: event.name,
        queueSize: queue.length,
      });

      // Process queue if immediate
      if (options.immediate) {
        await this.processQueue(event.name);
      }

      return true;
    } catch (error) {
      await this.handleError(error, {
        method: "queueEvent",
        event,
        options,
      });

      throw new EventError(
        ErrorCodes.EVENT.QUEUE_PROCESSING_FAILED,
        `Failed to queue event: ${event.name}`,
        { eventName: event.name, options },
        { cause: error }
      );
    }
  }

  /**
   * Process queued events
   * @param {string} queueName - Queue name
   * @returns {Promise<number>} - Number of processed events
   */
  async processQueue(queueName) {
    try {
      const queue = this.queues.get(queueName) || [];
      let processedCount = 0;

      const startTime = Date.now();

      while (queue.length > 0) {
        const { event } = queue.shift();
        try {
          await super.emit(event.name, event);
          processedCount++;
        } catch (handlerError) {
          throw new EventError(
            ErrorCodes.EVENT.HANDLER_ERROR,
            `Error in handler for event: ${event.name}`,
            { eventName: event.name, eventId: event.id },
            { cause: handlerError }
          );
        }
      }

      this.queues.set(queueName, queue);

      // Record metrics
      this.recordMetric("eventbus.queue.processed", processedCount, {
        queueName,
        processingTime: Date.now() - startTime,
      });

      return processedCount;
    } catch (error) {
      await this.handleError(error, {
        method: "processQueue",
        queueName,
      });

      throw new EventError(
        ErrorCodes.EVENT.QUEUE_PROCESSING_FAILED,
        `Failed to process queue: ${queueName}`,
        { queueName },
        { cause: error }
      );
    }
  }

  /**
   * Process all queued events
   * @returns {Promise<Object>} - Processing results
   */
  async processAllQueues() {
    try {
      const results = {};
      const queueNames = Array.from(this.queues.keys());

      for (const queueName of queueNames) {
        results[queueName] = await this.processQueue(queueName);
      }

      return results;
    } catch (error) {
      await this.handleError(error, {
        method: "processAllQueues",
      });

      throw new EventError(
        ErrorCodes.EVENT.QUEUE_PROCESSING_FAILED,
        "Failed to process all queues",
        {},
        { cause: error }
      );
    }
  }

  /**
   * Track events in history
   * @param {Object} event - Event object
   */
  trackEvent(event) {
    const history = this.history.get(event.name) || [];
    history.unshift(event);

    // Trim history if needed
    if (history.length > this.maxHistorySize) {
      history.pop();
    }

    this.history.set(event.name, history);

    // Record metric
    this.recordMetric("eventbus.history.size", history.length, {
      eventName: event.name,
    });
  }

  /**
   * Get event history
   * @param {string} eventName - Event name
   * @param {Object} options - History options
   * @returns {Array} - Event history
   */
  getHistory(eventName, options = {}) {
    const history = this.history.get(eventName) || [];

    if (options.limit && options.limit > 0) {
      return history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Get all event history
   * @param {Object} options - History options
   * @returns {Object} - All event history
   */
  getAllHistory(options = {}) {
    const result = {};

    for (const [eventName, history] of this.history) {
      result[eventName] = options.limit
        ? history.slice(0, options.limit)
        : history;
    }

    return result;
  }

  /**
   * Clear history and queues
   * @returns {Promise<void>}
   */
  async reset() {
    this.queues.clear();
    this.history.clear();

    // Only remove event listeners, keep system listeners
    const eventNames = this.eventNames().filter(
      (name) => !name.startsWith("system:")
    );
    for (const eventName of eventNames) {
      this.removeAllListeners(eventName);
    }

    // Record metric
    this.recordMetric("eventbus.reset", 1);
  }

  /**
   * Shutdown the event bus
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) return;

    try {
      this.state.status = "shutting_down";
      await this.reset();
      this.initialized = false;
      this.state.status = "shutdown";

      // Final shutdown event
      this.emit("system:shutdown", {
        timestamp: new Date().toISOString(),
      });

      // Remove all remaining listeners
      this.removeAllListeners();

      // Record metric
      this.recordMetric("eventbus.shutdown", 1);
    } catch (error) {
      this.state.status = "error";
      await this.handleError(error, { phase: "shutdown" });

      throw new EventError(
        ErrorCodes.EVENT.SHUTDOWN_FAILED,
        "Failed to shutdown EventBus",
        { state: this.state.status },
        { cause: error }
      );
    }
  }
}

/**
 * Factory function for container
 * @param {Object} deps - Dependencies
 * @returns {CoreEventBus} - Event bus instance
 */
export function createEventBus(deps = {}) {
  return new CoreEventBus(deps);
}
