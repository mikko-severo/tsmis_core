# Event System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [System Architecture](#system-architecture)
4. [Core Components](#core-components)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [Event Management](#event-management)
8. [Health Monitoring](#health-monitoring)
9. [Metrics Tracking](#metrics-tracking)
10. [System Lifecycle](#system-lifecycle)
11. [Dependency Validation](#dependency-validation)
12. [Status Reporting](#status-reporting)
13. [Testing Strategy](#testing-strategy)
14. [Best Practices](#best-practices)
15. [Using EventBus in Modules](#using-eventbus-in-modules)
16. [Troubleshooting](#troubleshooting)
17. [Areas for Improvement](#areas-for-improvement)

## Overview

The EventBus system provides centralized event management and message broker functionality for the TSMIS architecture. It serves as the communication backbone between modules while maintaining system boundaries and proper dependency management. The EventBus enables loose coupling between modules through an event-driven architecture pattern.

### Core Dependencies
```javascript
static dependencies = ['errorSystem', 'config'];
```

### Key Features
- Centralized event management
- Module-to-module communication
- Event history tracking
- Message queuing
- Pattern-based event subscription
- Error handling integration
- Health monitoring
- Metrics tracking
- Status reporting
- Dependency validation

## Core Concepts

### Event-Driven Communication

The EventBus system implements the publish-subscribe pattern (pub/sub) where:
- Publishers emit events without knowledge of subscribers
- Subscribers listen for events without knowledge of publishers
- Events carry data and metadata
- Communication is asynchronous and decoupled

### Core Dependencies

The EventBus system requires two essential dependencies:

```javascript
static dependencies = ['errorSystem', 'config'];
```

#### Dependency Resolution

Dependencies are resolved through one of these methods:

1. **Container Resolution** (primary method)
   - Dependencies are automatically injected by the Container
   - Container manages lifecycle and dependencies

2. **Default Fallbacks** (development/testing)
   - Default implementations for easier testing and development

3. **Explicit Injection**
   - Manual dependency injection for specialized cases

#### Default Fallbacks

```javascript
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
```

### Event Structure

Events in the system follow a standardized structure:

```javascript
const event = {
  id: crypto.randomUUID(),      // Unique event identifier
  name: eventName,              // Event name (e.g., 'user.created')
  data: payload,                // Event payload
  timestamp: new Date().toISOString(), // Event creation time
  metadata: options.metadata || {}    // Additional metadata
};
```

### Subscription Types

The EventBus supports several types of subscriptions:

1. **Direct Subscriptions**
   - Exact event name match
   ```javascript
   eventBus.subscribe('user.created', handler);
   
    // handler receives: (event)
    // where event = { id, name, data, timestamp, metadata }
    ```

2. **Wildcard Subscriptions**
   - Match all events
   - Automatically receive forwarded copies of all non-wildcard events
   ```javascript
   eventBus.subscribe('*', handler);
   
   // handler receives: (event)
   // where event = { id, name, data, timestamp, metadata }
   ```

3. **Pattern-Based Subscriptions**
   - Match events based on patterns
   ```javascript
   eventBus.subscribe('user.*', handler); // All user events
   eventBus.subscribe('*.created', handler); // All creation events

    // handler receives: (event)
   // where event = { id, name, data, timestamp, metadata }
   ```


#### Wildcard Event Handling

The EventBus supports wildcard event listening through a special '*' event pattern. When a wildcard listener is added:

1. The system sets up special event forwarding.
2. All events are automatically forwarded to wildcard subscribers.
3. Wildcard subscribers receive events in the same format as direct subscribers.

```javascript
eventBus.subscribe('*', (event) => {
  console.log(`Received event: ${event.name}`);
  console.log(`Event data:`, event.data);
});

// All events will be forwarded to this handler with a consistent format
```



### Event Queuing

Events can be queued for delayed processing:

```javascript
// Queue event
await eventBus.emit('user.created', userData, { queue: true });

// Process all queued 'user.created' events
await eventBus.processQueue('user.created');

// Process all queued events
await eventBus.processAllQueues();
```

## System Architecture

### Architecture Flow
```mermaid
graph TB
    Container --> EventBusSystem
    EventBusSystem --> CoreEventBus
    
    CoreEventBus --> |Events| ModuleA[Module A]
    CoreEventBus --> |Events| ModuleB[Module B]
    
    ModuleA --> |Emit| CoreEventBus
    ModuleB --> |Emit| CoreEventBus
    
    ErrorSystem --> |Error Handling| CoreEventBus
    EventError --> |Specialized Errors| CoreEventBus
    EventError --> |Specialized Errors| EventBusSystem
```

### Integration with Other Systems

The EventBus system integrates with:

1. **ErrorSystem**
   - Error handling and forwarding
   - Error context enrichment
   - Error history management
   - Specialized EventError type

2. **ModuleSystem**
   - Inter-module communication
   - Module lifecycle events
   - Module health monitoring

3. **CoreContainer**
   - Dependency injection
   - Lifecycle management

## Core Components

### CoreEventBus

The CoreEventBus is the fundamental event handling component:

```javascript
export class CoreEventBus extends EventEmitter {
  static dependencies = ['errorSystem', 'config'];
  static version = '1.0.0';

  constructor(deps = {}) {
    super();
    this.deps = deps;
    this.queues = new Map();
    this.subscriptions = new Map();
    this.history = new Map();
    this.maxHistorySize = deps.config?.eventHistory?.maxSize || 1000;
    this.initialized = false;
    this.state = {
      status: 'created',
      startTime: null,
      metrics: new Map(),
      errors: [],
      healthChecks: new Map()
    };
  }

  // Core methods
  async initialize() { /* ... */ }
  async emit(eventName, data, options = {}) { /* ... */ }
  subscribe(pattern, handler, options = {}) { /* ... */ }
  unsubscribe(subscriptionId) { /* ... */ }
  async queueEvent(event, options = {}) { /* ... */ }
  async processQueue(queueName) { /* ... */ }
  async processAllQueues() { /* ... */ }
  async reset() { /* ... */ }
  async shutdown() { /* ... */ }
  
  // Health monitoring
  async checkHealth() { /* ... */ }
  registerHealthCheck(name, checkFn) { /* ... */ }
  
  // History and metrics
  trackEvent(event) { /* ... */ }
  getHistory(eventName, options = {}) { /* ... */ }
  getAllHistory(options = {}) { /* ... */ }
  recordMetric(name, value, tags = {}) { /* ... */ }
}
```

### EventBusSystem

The EventBusSystem manages the CoreEventBus and provides system-level functionality:

```javascript
export class EventBusSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'config'];
  static version = '1.0.0';

  constructor(deps) {
    super();
    this.deps = deps;
    this.eventBus = null;
    this.initialized = false;
    this.state = {
      status: 'created',
      startTime: null,
      metrics: new Map(),
      errors: [],
      healthChecks: new Map()
    };
  }

  // Core methods
  async initialize() { /* ... */ }
  getEventBus() { /* ... */ }
  async shutdown() { /* ... */ }
  
  // Health monitoring
  async checkHealth() { /* ... */ }
  registerHealthCheck(name, checkFn) { /* ... */ }
  
  // Status and metrics
  getStatus() { /* ... */ }
  getMetrics() { /* ... */ }
  recordMetric(name, value, tags = {}) { /* ... */ }
  
  // Event forwarding
  setupEventForwarding() { /* ... */ }
  async emit(eventName, ...args) { /* ... */ }
  
  // Dependency validation
  validateDependencies() { /* ... */ }
}
```

## State Management

### EventBus States

Both CoreEventBus and EventBusSystem transition through the following states during their lifecycle:

- **created**: Initial state after instantiation
- **initializing**: During initialization process
- **running**: System is active and operational
- **shutting_down**: During shutdown process
- **shutdown**: System is inactive
- **error**: Error state when something fails

### State Tracking

The state object stores comprehensive system metadata:

```javascript
this.state = {
  status: 'created',          // Current system state
  startTime: null,            // When system was started
  errors: [],                 // Error history
  metrics: new Map(),         // Performance metrics
  healthChecks: new Map()     // Health check functions
};
```

### Metrics Tracking

The EventBus system tracks various metrics:

```javascript
// Record a metric
eventBus.recordMetric('events.processed', 42, { 
  eventType: 'user.created',
  source: 'userModule'
});

// Get metrics
const metrics = eventBusSystem.getMetrics();
```

Key metrics include:
- Event emission counts
- Subscription counts
- Queue sizes
- Processing times
- Error counts

## Error Handling

### EventError Type

The EventBus system utilizes a specialized `EventError` type for event-related errors:

```javascript
import { CoreError } from '../Error.js';

/**
 * Event system related errors
 * @extends CoreError
 */
export class EventError extends CoreError {
  /**
   * Create a new EventError
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @param {Object} [options={}] - Error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(`EVENT_${code}`, message, details, options);
    this.statusCode = 500;
  }
}
```

### Event Error Codes

The system defines specific error codes for event-related errors:

```javascript
// Event related error codes
EVENT: {
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  EMISSION_FAILED: 'EMISSION_FAILED',
  SUBSCRIPTION_FAILED: 'SUBSCRIPTION_FAILED',
  INVALID_PATTERN: 'INVALID_PATTERN',
  INVALID_EVENT_NAME: 'INVALID_EVENT_NAME',
  INVALID_HANDLER: 'INVALID_HANDLER',
  QUEUE_PROCESSING_FAILED: 'QUEUE_PROCESSING_FAILED',
  HANDLER_NOT_FOUND: 'HANDLER_NOT_FOUND',
  HANDLER_ERROR: 'HANDLER_ERROR',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  SHUTDOWN_FAILED: 'SHUTDOWN_FAILED',
  MISSING_DEPENDENCIES: 'MISSING_DEPENDENCIES',
  INVALID_DEPENDENCY: 'INVALID_DEPENDENCY'
}
```

### Error Management

Both CoreEventBus and EventBusSystem include robust error handling:

```javascript
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
  this.recordMetric('eventbus.errors', 1, {
    errorType: error.constructor.name,
    errorCode: error.code
  });
  
  // Forward to error system if available
  if (this.deps.errorSystem) {
    try {
      await this.deps.errorSystem.handleError(error, {
        source: 'CoreEventBus', // or 'EventBusSystem'
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
```

### Error Propagation

Errors during event emission are handled gracefully:

```javascript
async emit(eventName, data, options = {}) {
  try {
    // Validate event name
    if (!eventName || typeof eventName !== 'string') {
      throw new EventError(
        ErrorCodes.EVENT.INVALID_EVENT_NAME,
        'Event name must be a non-empty string',
        { providedEventName: eventName }
      );
    }

    // Event emission logic
    // ...
  } catch (error) {
    await this.handleError(error, {
      eventName,
      data,
      options
    });
    
    // Wrap original error if needed
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
```

### Error Handling in Event Handlers

When implementing event handlers, always use try/catch:

```javascript
eventBus.subscribe('user.created', async (event) => {
  try {
    // Handle event
    await processUser(event.data);
  } catch (error) {
    // Forward to error system
    await module.handleError(error, { 
      event, 
      handler: 'processNewUser' 
    });
  }
});
```

## Event Management

### Event Emission

Events can be emitted with various options:

```javascript
// Basic event emission
await eventBus.emit('user.created', {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com'
});

// Event with metadata
await eventBus.emit('user.created', userData, {
  metadata: {
    source: 'registration-form',
    ip: '192.168.1.1'
  }
});

// Queued event
await eventBus.emit('bulk.process', largeDataset, {
  queue: true
});

// Immediate queue processing
await eventBus.emit('notification.send', notification, {
  queue: true,
  immediate: true
});
```

### Event Subscription

Modules can subscribe to events in several ways:

```javascript
// Direct subscription
const subId = eventBus.subscribe('user.created', handleUserCreated);

// Wildcard subscription (all events)
eventBus.subscribe('*', logAllEvents);

// Pattern subscription (all user events)
eventBus.subscribe('user.*', handleUserEvents);

// Pattern subscription (all creation events)
eventBus.subscribe('*.created', handleCreationEvents);

// Unsubscribe
eventBus.unsubscribe(subId);
```

### Event History

The EventBus maintains a history of emitted events:

```javascript
// Get history for a specific event
const userCreatedEvents = eventBus.getHistory('user.created');

// Limit history results
const recentUserEvents = eventBus.getHistory('user.created', { limit: 10 });

// Get all event history
const allHistory = eventBus.getAllHistory();
```

### Queue Management

Events can be queued and processed in batches:

```javascript
// Process a specific queue
await eventBus.processQueue('email.send');

// Process all queues
await eventBus.processAllQueues();
```

### Enhanced Event Forwarding

The EventBusSystem includes improved event forwarding to avoid loops:

```javascript
setupEventForwarding() {
  if (!this.eventBus) return;
  
  // Listen for all events on the eventBus and forward them
  this.eventBus.on('*', (eventName, event) => {
    // Forward non-system events to system
    if (!eventName.startsWith('system:')) {
      super.emit(eventName, event);
    }
  });
  
  // Listen for system events specifically to avoid duplication
  this.eventBus.on('system:*', (eventName, event) => {
    // Forward to system level
    super.emit(eventName, event);
  });
}
```

## Health Monitoring

### Health Check Implementation

The EventBus system includes comprehensive health monitoring:

```javascript
// Register a custom health check
eventBus.registerHealthCheck('connection', async () => {
  const connected = await checkConnection();
  return {
    status: connected ? 'healthy' : 'unhealthy',
    details: { connected }
  };
});

// Get health status
const health = await eventBus.checkHealth();
```

### Default Health Checks

CoreEventBus includes these default health checks:

1. **state**: System state check
   - Checks if the system is initialized and running
   - Reports uptime and error count

2. **queues**: Queue health check
   - Reports queue sizes and total queued events
   - Monitors for queue buildup

3. **subscriptions**: Subscription check
   - Reports subscription count and patterns
   - Ensures event handlers are registered

EventBusSystem includes these default health checks:

1. **state**: System state check
   - Checks if the system is initialized and running
   - Reports uptime and error count

2. **eventBus**: EventBus health check
   - Forwards to the CoreEventBus health check if available
   - Reports status of the underlying event bus

### Health Check Results

Health check results follow a consistent format:

```javascript
{
  name: 'CoreEventBus',
  version: '1.0.0',
  status: 'healthy', // or 'unhealthy', 'error'
  timestamp: '2024-03-27T12:34:56.789Z',
  checks: {
    state: {
      status: 'healthy',
      uptime: 3600000, // ms
      errorCount: 0
    },
    queues: {
      status: 'healthy',
      queueCount: 2,
      totalQueuedEvents: 10,
      queues: {
        'email.send': 8,
        'notification.push': 2
      }
    },
    subscriptions: {
      status: 'healthy',
      count: 5,
      patterns: ['user.created', 'user.updated', 'system.*', '*', 'email.*']
    }
  }
}
```

## Metrics Tracking

The EventBus system provides comprehensive metrics tracking:

```javascript
// Record a metric
eventBusSystem.recordMetric('eventbussystem.events.processed', 42, { 
  eventType: 'user.created' 
});

// Get all metrics
const metrics = eventBusSystem.getMetrics();
console.log('System metrics:', metrics);

// Output format:
{
  "eventbussystem.events.processed": {
    "value": 42,
    "timestamp": 1711541696000,
    "tags": {
      "eventType": "user.created"
    }
  },
  "eventbussystem.initialized": {
    "value": 1,
    "timestamp": 1711541695000,
    "tags": {}
  }
}
```

Key metrics automatically tracked by the system:

- `eventbussystem.initialized`: Records when initialization completes
- `eventbussystem.shutdown`: Records when shutdown completes
- `eventbussystem.errors`: Records error occurrences
- `eventbussystem.initialization.failed`: Records initialization failures
- `eventbussystem.shutdown.failed`: Records shutdown failures
- `eventbus.events.emitted`: Records event emissions
- `eventbus.subscriptions`: Records subscription additions
- `eventbus.unsubscriptions`: Records subscription removals
- `eventbus.queued`: Records event queuing
- `eventbus.queue.processed`: Records queue processing

## System Lifecycle

### Initialization

The EventBusSystem initialization process:

```javascript
async initialize() {
  if (this.initialized) {
    throw new EventError(
      ErrorCodes.EVENT.INITIALIZATION_FAILED, 
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
    
    // Set up event forwarding
    this.setupEventForwarding();
    
    await this.eventBus.initialize();

    this.initialized = true;
    this.state.status = 'running';
    
    // Record metric
    this.recordMetric('eventbussystem.initialized', 1);
    
    // Emit initialization event
    this.emit('system:initialized', {
      timestamp: new Date().toISOString()
    });
    
    return this;
  } catch (error) {
    this.state.status = 'error';
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
        ErrorCodes.EVENT.INITIALIZATION_FAILED,
        'Failed to initialize EventBusSystem',
        { originalError: error.message },
        { cause: error }
      );
    }
    
    throw error;
  }
}
```

### Shutdown

The EventBusSystem shutdown process:

```javascript
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
```

### Container Registration

Register the EventBusSystem with the container in your application:

```javascript
// src/app.js
import { createEventBusSystem } from './core/event/EventBusSystem.js';

// Register with container
container.register('eventBusSystem', createEventBusSystem);

// Registration order
container.register('errorSystem', createErrorSystem);
container.register('config', () => ({}));
container.register('eventBusSystem', createEventBusSystem);
container.register('moduleSystem', createModuleSystem);
```

## Dependency Validation

The EventBusSystem performs thorough dependency validation:

```javascript
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
```

This validation ensures:
- All required dependencies are provided
- Dependencies implement expected interfaces
- Early failure if dependency requirements aren't met

## Status Reporting

The EventBusSystem provides a `getStatus()` method for system monitoring:

```javascript
// Get system status
const status = eventBusSystem.getStatus();
console.log('EventBusSystem status:', JSON.stringify(status, null, 2));

// Status object format:
{
  "name": "EventBusSystem",
  "version": "1.0.0",
  "status": "running", // 'created', 'initializing', 'running', 'shutting_down', 'shutdown', 'error'
  "uptime": 3600000, // ms since start
  "initialized": true,
  "errorCount": 0,
  "timestamp": "2024-03-27T12:34:56.789Z"
}
```

The status report provides:
- Current system state
- System uptime
- Initialization status
- Error count
- Timestamp

## Testing Strategy

### EventBus Testing

Example of testing the CoreEventBus:

```javascript
describe('CoreEventBus', () => {
  let eventBus;
  let mockErrorSystem;
  
  beforeEach(() => {
    // Create mock dependencies
    mockErrorSystem = {
      handleError: jest.fn()
    };
    
    // Create EventBus instance
    eventBus = new CoreEventBus({
      errorSystem: mockErrorSystem,
      config: {
        eventHistory: {
          maxSize: 5
        }
      }
    });
  });
  
  afterEach(() => {
    // Clean up
    if (eventBus.initialized) {
      eventBus.shutdown();
    }
  });
  
  test('should emit events', async () => {
    await eventBus.initialize();
    
    const handler = jest.fn();
    eventBus.on('test.event', handler);
    
    await eventBus.emit('test.event', { message: 'Hello' });
    
    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0]).toHaveProperty('name', 'test.event');
    expect(handler.mock.calls[0][0]).toHaveProperty('data', { message: 'Hello' });
  });
  
  test('should throw EventError for invalid event name', async () => {
    await eventBus.initialize();
    
    await expect(eventBus.emit(null, { data: 'test' }))
      .rejects
      .toThrow(EventError);
  });
  
  // More tests...
});
```

### EventBusSystem Testing

Example of testing the EventBusSystem:

```javascript
describe('EventBusSystem', () => {
  let eventBusSystem;
  let mockErrorSystem;
  
  beforeEach(() => {
    mockErrorSystem = {
      handleError: jest.fn()
    };
    
    eventBusSystem = new EventBusSystem({
      errorSystem: mockErrorSystem,
      config: {}
    });
  });
  
  afterEach(async () => {
    if (eventBusSystem.initialized) {
      await eventBusSystem.shutdown();
    }
  });
  
  test('should initialize correctly', async () => {
    await eventBusSystem.initialize();
    
    expect(eventBusSystem.initialized).toBe(true);
    expect(eventBusSystem.state.status).toBe('running');
    expect(eventBusSystem.eventBus).toBeInstanceOf(CoreEventBus);
  });
  
  test('should validate dependencies', async () => {
    const invalidSystem = new EventBusSystem({});
    await expect(invalidSystem.initialize())
      .rejects
      .toThrow(EventError);
  });
  
  // More tests...
});
```

### Testing Event Handlers

Example of testing a module's event handlers:

```javascript
describe('UserModule event handlers', () => {
  let userModule;
  let mockEventBus;
  
  beforeEach(() => {
    // Create mock event bus
    mockEventBus = {
      subscribe: jest.fn(),
      emit: jest.fn()
    };
    
    // Create mock event bus system
    const mockEventBusSystem = {
      getEventBus: () => mockEventBus
    };
    
    // Create module with mocked dependencies
    userModule = new UserModule({
      eventBusSystem: mockEventBusSystem,
      // Other dependencies...
    });
  });
  
  test('should handle user.created events', async () => {
    // Extract the handler function
    await userModule.setupEventHandlers();
    const [[eventName, handler]] = mockEventBus.subscribe.mock.calls;
    
    expect(eventName).toBe('user.created');
    
    // Create a mock event
    const mockEvent = {
      id: 'event-123',
      name: 'user.created',
      data: { id: 'user-123', name: 'John Doe' },
      timestamp: new Date().toISOString()
    };
    
    // Call the handler directly
    await handler(mockEvent);
    
    // Assert expected behavior
    // ...
  });
});
```

## Best Practices

### 1. Event Naming

Follow these event naming conventions:

- Use domain-driven event names: `domain.action`
- Include version for breaking changes: `user.created.v2`
- Use past tense for state changes: `user.created`, `order.completed`
- Use present tense for commands: `notification.send`, `email.process`
- Be specific and descriptive

Examples:
```javascript
// Good
eventBus.emit('user.registered', userData);
eventBus.emit('order.completed', orderData);
eventBus.emit('payment.failed', paymentError);

// Bad - too generic
eventBus.emit('created', userData);
eventBus.emit('process', orderData);
```

### 2. Event Data Structure

Follow these guidelines for event data:

- Keep event data serializable (JSON-compatible)
- Include all necessary context in the data
- Avoid circular references
- Use consistent data structures for similar events
- Don't include sensitive information

Example:
```javascript
// Good
await eventBus.emit('user.created', {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date().toISOString(),
  roles: ['user'],
  settings: {
    notifications: true,
    theme: 'dark'
  }
});

// Bad - includes DB model, sensitive data
await eventBus.emit('user.created', userDbModel);
```

### 3. Event Handling

Implement robust event handlers:

- Always use try/catch in handlers
- Validate event data before processing
- Keep handlers focused on a single responsibility
- Use proper error context
- Make handlers idempotent when possible

Example:
```javascript
eventBus.subscribe('order.created', async (event) => {
  try {
    // Validate event data
    if (!event.data || !event.data.id) {
      throw new ValidationError('INVALID_ORDER_DATA', 'Order data is missing required fields');
    }
    
    // Process event
    await processOrder(event.data);
    
    // Record metric
    this.recordMetric('orders.processed', 1, {
      orderId: event.data.id
    });
  } catch (error) {
    // Handle error
    await this.handleError(error, {
      event,
      handler: 'processOrderCreated'
    });
  }
});
```

### 4. Subscription Management

Manage subscriptions properly:

- Set up handlers in module initialization
- Clean up subscriptions on shutdown
- Store subscription IDs for later cleanup
- Use appropriate pattern matching
- Avoid wildcard subscriptions for performance-critical code

Example:
```javascript
class OrderModule extends CoreModule {
  constructor(deps) {
    super(deps);
    this.subscriptions = [];
  }
  
  async setupEventHandlers() {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    // Store subscription IDs
    this.subscriptions.push(
      eventBus.subscribe('order.created', this.handleOrderCreated.bind(this)),
      eventBus.subscribe('payment.completed', this.handlePaymentCompleted.bind(this)),
      eventBus.subscribe('shipping.status.*', this.handleShippingUpdates.bind(this))
    );
  }
  
  async onShutdown() {
    // Clean up subscriptions
    const eventBus = this.deps.eventBusSystem.getEventBus();
    for (const subId of this.subscriptions) {
      eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
  }
}
```

### 5. Error Handling

Use specialized EventError for event-related errors:

```javascript
// Throwing specific event errors
if (!pattern || typeof pattern !== 'string') {
  throw new EventError(
    ErrorCodes.EVENT.INVALID_PATTERN,
    'Event pattern must be a non-empty string',
    { providedPattern: pattern }
  );
}

// Catching and wrapping errors
try {
  await this.eventBus.emit('user.created', userData);
} catch (error) {
  // Handle error and wrap if it's not already an EventError
  if (!(error instanceof EventError)) {
    throw new EventError(
      ErrorCodes.EVENT.EMISSION_FAILED,
      'Failed to emit user.created event',
      { userId: userData.id },
      { cause: error }
    );
  }
  throw error;
}
```

## Using EventBus in Modules

### Module Access to EventBus

Modules should access the EventBus through the EventBusSystem:

```javascript
class BusinessModule extends CoreModule {
  constructor(deps) {
    super(deps);
    // Get eventBus from eventBusSystem
    this.eventBus = deps.eventBusSystem.getEventBus();
  }
}
```

### Setting Up Event Handlers

Implement the `setupEventHandlers` method to set up event handlers:

```javascript
class UserModule extends CoreModule {
  async setupEventHandlers() {
    // Get eventBus from eventBusSystem
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    // Store subscription IDs for cleanup
    this.subscriptions = [
      // Handle user events
      eventBus.subscribe('user.created', this.handleUserCreated.bind(this)),
      eventBus.subscribe('user.updated', this.handleUserUpdated.bind(this)),
      eventBus.subscribe('user.deleted', this.handleUserDeleted.bind(this)),
      
      // Handle related events
      eventBus.subscribe('auth.login', this.handleUserLogin.bind(this)),
      eventBus.subscribe('auth.logout', this.handleUserLogout.bind(this))
    ];
  }
  
  // Event handlers
  async handleUserCreated(event) {
    try {
      const userData = event.data;
      // Process the user creation...
      await this.db.createUserProfile(userData);
      
      // Emit consequent events
      await this.eventBus.emit('profile.created', {
        userId: userData.id,
        profile: { /* profile data */ }
      });
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleUserCreated'
      });
    }
  }
  
  // More handlers...
}
```

### Cleaning Up Subscriptions

Clean up subscriptions in the `onShutdown` method:

```javascript
class UserModule extends CoreModule {
  // Other methods...
  
  async onShutdown() {
    // Clean up subscriptions
    if (this.eventBus) {
      for (const subId of this.subscriptions) {
        this.eventBus.unsubscribe(subId);
      }
    }
    this.subscriptions = [];
  }
}
```

### Complete Module Example

A complete example of a module using the EventBus:

```javascript
import { CoreModule } from '../core/module/Module.js';
import { ValidationError, EventError, ErrorCodes } from '../core/errors/index.js';

export class UserModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'database'];
  static version = '1.0.0';
  
  constructor(deps) {
    super(deps);
    this.db = deps.database;
    this.subscriptions = [];
    this.userCache = new Map();
  }
  
  async onConfigure() {
    // Initialize cache settings
    this.cacheEnabled = this.config.userCache?.enabled || true;
    this.cacheTTL = this.config.userCache?.ttl || 3600000; // 1 hour
  }
  
  async setupEventHandlers() {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    this.subscriptions = [
      eventBus.subscribe('user.created', this.handleUserCreated.bind(this)),
      eventBus.subscribe('user.updated', this.handleUserUpdated.bind(this)),
      eventBus.subscribe('user.deleted', this.handleUserDeleted.bind(this)),
      eventBus.subscribe('cache.clear', this.handleCacheClear.bind(this))
    ];
  }
  
  async onSetupHealthChecks() {
    // Register user cache health check
    this.registerHealthCheck('userCache', async () => {
      return {
        status: 'healthy',
        size: this.userCache.size,
        enabled: this.cacheEnabled
      };
    });
  }
  
  // Business methods
  async createUser(userData) {
    try {
      // Validate user data
      if (!userData.email) {
        throw new ValidationError('MISSING_EMAIL', 'Email is required');
      }
      
      // Create user in database
      const user = await this.db.users.create(userData);
      
      // Update cache
      if (this.cacheEnabled) {
        this.userCache.set(user.id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
      
      // Emit event
      try {
        await this.eventBus.emit('user.created', user);
      } catch (eventError) {
        // Log but don't fail the operation
        await this.handleError(eventError, {
          method: 'createUser',
          event: 'user.created',
          userId: user.id
        });
      }
      
      // Record metric
      this.recordMetric('users.created', 1);
      
      return user;
    } catch (error) {
      await this.handleError(error, {
        method: 'createUser',
        userData
      });
      throw error;
    }
  }
  
  // Event handlers
  async handleUserCreated(event) {
    try {
      const user = event.data;
      
      // Update cache if event came from another instance
      if (this.cacheEnabled && event.metadata?.source !== this.instanceId) {
        this.userCache.set(user.id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
      
      // Perform additional processing
      await this.sendWelcomeEmail(user);
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleUserCreated'
      });
    }
  }
  
  async handleUserUpdated(event) {
    try {
      const user = event.data;
      
      // Update cache
      if (this.cacheEnabled) {
        this.userCache.set(user.id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleUserUpdated'
      });
    }
  }
  
  async handleUserDeleted(event) {
    try {
      const { userId } = event.data;
      
      // Remove from cache
      if (this.cacheEnabled) {
        this.userCache.delete(userId);
      }
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleUserDeleted'
      });
    }
  }
  
  async handleCacheClear(event) {
    try {
      if (event.data.target === 'all' || event.data.target === 'users') {
        this.userCache.clear();
        this.recordMetric('cache.cleared', 1, { target: 'users' });
      }
    } catch (error) {
      await this.handleError(error, {
        event,
        handler: 'handleCacheClear'
      });
    }
  }
  
  async onShutdown() {
    // Clean up subscriptions
    if (this.eventBus) {
      for (const subId of this.subscriptions) {
        this.eventBus.unsubscribe(subId);
      }
    }
    
    // Clear cache
    this.userCache.clear();
  }
}
```

## Troubleshooting

### Common Issues

1. **Event Bus Not Initialized**
   - **Symptom**: `EVENT_NOT_INITIALIZED` error when trying to get or use EventBus
   - **Solution**: Ensure EventBusSystem is initialized before use
   ```javascript
   // Check initialization
   if (!this.initialized) {
     throw new EventError(
       ErrorCodes.EVENT.NOT_INITIALIZED,
       'EventBusSystem is not initialized'
     );
   }
   ```

2. **Missing Dependencies**
   - **Symptom**: `EVENT_MISSING_DEPENDENCIES` error during initialization
   - **Solution**: Ensure all required dependencies are provided
   ```javascript
   // Validate dependencies
   const missing = this.constructor.dependencies.filter(
     dep => !this.deps[dep]
   );

   if (missing.length > 0) {
     throw new EventError(
       ErrorCodes.EVENT.MISSING_DEPENDENCIES,
       `Missing required dependencies: ${missing.join(', ')}`
     );
   }
   ```

3. **Event Handler Errors**
   - **Symptom**: `EVENT_HANDLER_ERROR` during event processing
   - **Solution**: Always use try/catch in handlers
   ```javascript
   try {
     await handler(event);
   } catch (error) {
     await this.handleError(error, {
       event,
       handler: handler.name
     });
   }
   ```

4. **Events Not Received**
   - **Symptom**: Event handlers not being triggered
   - **Solution**: Check event names, patterns, and subscription setup
   ```javascript
   // Debug event subscriptions
   console.log('Subscriptions:', Array.from(eventBus.subscriptions.values()));
   
   // Add debug listener
   eventBus.subscribe('*', (event) => {
     console.log('Event received:', event.name, event);
   });
   ```

5. **Memory Leaks**
   - **Symptom**: Increasing memory usage over time
   - **Solution**: Ensure proper cleanup of subscriptions and event history
   ```javascript
   // Clean up subscriptions
   for (const subId of this.subscriptions) {
     eventBus.unsubscribe(subId);
   }
   
   // Limit event history size
   if (history.length > this.maxHistorySize) {
     history.pop(); // Remove oldest events
   }
   ```

### Debugging Techniques

1. **Enable Event Logging**
   ```javascript
   // Add a global event listener
   eventBus.subscribe('*', (event) => {
     console.log(`[${new Date().toISOString()}] Event:`, event.name, event);
   });
   ```

2. **Check Event History**
   ```javascript
   // Check history for a specific event
   const history = eventBus.getHistory('user.created');
   console.log('Event history:', history);
   
   // Check all event history
   const allHistory = eventBus.getAllHistory();
   console.log('All event history:', allHistory);
   ```

3. **Monitor Health**
   ```javascript
   // Check health status
   const health = await eventBus.checkHealth();
   console.log('EventBus health:', JSON.stringify(health, null, 2));
   ```

4. **Inspect Subscriptions**
   ```javascript
   // Log all subscriptions
   const subscriptions = Array.from(eventBus.subscriptions.values());
   console.log('Active subscriptions:', subscriptions);
   ```

5. **Check Queues**
   ```javascript
   // Check queue sizes
   const queueSizes = {};
   for (const [name, queue] of eventBus.queues.entries()) {
     queueSizes[name] = queue.length;
   }
   console.log('Queue sizes:', queueSizes);
   ```

6. **Monitor System Status**
   ```javascript
   // Check system status
   const status = eventBusSystem.getStatus();
   console.log('System status:', JSON.stringify(status, null, 2));
   ```

7. **Track Metrics**
   ```javascript
   // Check all system metrics
   const metrics = eventBusSystem.getMetrics();
   console.log('System metrics:', metrics);
   ```

### Common Error Codes

- `EVENT_NOT_INITIALIZED`: EventBus or EventBusSystem is not initialized
- `EVENT_ALREADY_INITIALIZED`: EventBus or EventBusSystem is already initialized
- `EVENT_MISSING_DEPENDENCIES`: Required dependencies are missing
- `EVENT_INVALID_DEPENDENCY`: Dependency missing required interface
- `EVENT_INVALID_HANDLER`: Invalid handler function provided
- `EVENT_INVALID_PATTERN`: Invalid event pattern format
- `EVENT_INVALID_EVENT_NAME`: Invalid event name format
- `EVENT_SUBSCRIPTION_FAILED`: Failed to create subscription
- `EVENT_EMISSION_FAILED`: Failed to emit event
- `EVENT_HANDLER_NOT_FOUND`: Specified handler not found
- `EVENT_HANDLER_ERROR`: Error occurred in event handler
- `EVENT_QUEUE_PROCESSING_FAILED`: Failed to process event queue
- `EVENT_INITIALIZATION_FAILED`: Failed to initialize system
- `EVENT_SHUTDOWN_FAILED`: Failed to shutdown system

## Areas for Improvement

1. **Advanced Event Routing**:
   - Implement topic-based routing with hierarchical topics
   - Add support for content-based routing (filtering events based on content)
   - Create routing rules for complex event processing
   - Support dynamic route configuration

2. **Event Validation**:
   - Add schema validation for events
   - Implement event versioning and schema evolution
   - Create event format validation
   - Support typed events with runtime validation

3. **Performance Optimization**:
   - Implement batched event processing
   - Add support for worker threads for parallel processing
   - Create optimized subscription matching algorithm
   - Support high-throughput scenarios

4. **Distributed Event Processing**:
   - Add support for distributed event buses across instances
   - Implement consistent event ordering in distributed setups
   - Create cross-service event propagation
   - Support cloud-based event distribution

5. **Event Persistence**:
   - Implement event sourcing capabilities
   - Add durable subscriptions and reliable delivery
   - Create event replay functionality
   - Support event journaling and recovery

6. **Event Observability**:
   - Add comprehensive event tracing
   - Implement causality tracking between events
   - Create visual event flow monitoring
   - Support OpenTelemetry integration

7. **Advanced Pattern Matching**:
   - Implement more sophisticated pattern matching (regex, glob)
   - Add content-based filtering for subscriptions
   - Create complex condition matching for events
   - Support composite event patterns (AND/OR logic)

8. **Security Enhancements**:
   - Add permission-based event publishing and subscription
   - Implement event content encryption
   - Create audit logging for sensitive events
   - Support fine-grained access control