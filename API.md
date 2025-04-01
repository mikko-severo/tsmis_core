# TSMIS Core API Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Core Container API](#core-container-api)
3. [Error System API](#error-system-api)
4. [Event Bus System API](#event-bus-system-api)
5. [Module System API](#module-system-api)
6. [Integration Patterns](#integration-patterns)
7. [API Stability and Versioning](#api-stability-and-versioning)

---

## Introduction

TSMIS Core is a modular, event-driven runtime for building enterprise Node.js applications. This documentation provides comprehensive details about all APIs exposed by TSMIS Core, including method signatures, parameters, return values, examples, and common usage patterns.

The TSMIS Core API consists of four major systems:

1. **Core Container**: Dependency injection and lifecycle management
2. **Error System**: Structured error handling and propagation
3. **Event Bus System**: Event-driven communication between modules
4. **Module System**: Business module management and orchestration

Each system is designed to work both independently and in coordination with the others, allowing for flexible usage in various application contexts.

---

## Core Container API

The Core Container system provides dependency injection, component lifecycle management, and runtime wiring for your application components.

### CoreContainer

The central dependency injection container that manages component registration, resolution, and lifecycle.

#### Constructor

```javascript
import { CoreContainer } from 'tsmis-core';

const container = new CoreContainer();
```

Creates a new container instance with no registered components.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| initialized | boolean | Whether the container has been initialized |
| components | Map | Map of registered components (private) |
| instances | Map | Map of resolved component instances (private) |
| dependencies | Map | Map of component dependencies (private) |

#### Methods

##### `register(name, Component, options = {})`

Registers a component with the container.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Unique name for the component |
| Component | Function\|Object | Component constructor, factory function, or direct instance |
| options | Object | Registration options |
| options.singleton | boolean | Whether the component should be a singleton (default: true) |

**Returns:** `CoreContainer` - The container instance for chaining

**Example:**

```javascript
// Register a class constructor
class Logger {
  log(message) {
    console.log(message);
  }
}

container.register('logger', Logger);

// Register a factory function
function createDatabase(deps) {
  return {
    query: async (sql) => {
      console.log(`Executing query: ${sql}`);
      return [];
    }
  };
}

container.register('database', createDatabase);

// Register a direct instance
const config = { apiUrl: 'https://api.example.com' };
container.register('config', config);
```

##### `async resolve(name)`

Resolves a registered component, creating an instance if needed and injecting dependencies.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Name of the component to resolve |

**Returns:** `Promise<any>` - The resolved component instance

**Throws:**
- `ServiceError`: If the component is not registered

**Example:**

```javascript
// Resolve a component
const logger = await container.resolve('logger');
logger.log('Hello, world!');

// Resolve a component with dependencies
class UserService {
  static dependencies = ['database', 'logger'];
  
  constructor(deps) {
    this.database = deps.database;
    this.logger = deps.logger;
  }
  
  async getUsers() {
    this.logger.log('Fetching users');
    return this.database.query('SELECT * FROM users');
  }
}

container.register('userService', UserService);
const userService = await container.resolve('userService');
```

##### `async initialize()`

Initializes all registered components in dependency order.

**Returns:** `Promise<void>`

**Throws:**
- `ServiceError`: If the container is already initialized
- `ConfigError`: If there are circular dependencies
- Any errors thrown by component initialization

**Example:**

```javascript
await container.initialize();
```

##### `async shutdown()`

Shuts down all initialized components in reverse dependency order.

**Returns:** `Promise<void>`

**Example:**

```javascript
await container.shutdown();
```

##### `registerManifest(type, manifest)`

Registers a component manifest for dynamic component discovery.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Component type |
| manifest | Object | Component manifest definition |

**Returns:** `CoreContainer` - The container instance for chaining

**Example:**

```javascript
container.registerManifest('service', {
  configSchema: {
    /* JSON schema for service configuration */
  }
});
```

##### `async discover(type, basePath)`

Discovers components based on a registered manifest.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Component type |
| basePath | string | Base directory path |

**Returns:** `Promise<Map>` - Map of discovered components

**Example:**

```javascript
const services = await container.discover('service', './services');
```

#### Events

The `CoreContainer` extends `EventEmitter` and emits the following events:

| Event | Payload | Description |
|-------|---------|-------------|
| `component:registered` | `{ name, Component }` | Emitted when a component is registered |
| `component:resolved` | `{ name, instance }` | Emitted when a component is resolved |
| `manifest:registered` | `{ type, manifest }` | Emitted when a manifest is registered |
| `initialized` | none | Emitted when the container is initialized |
| `shutdown` | none | Emitted when the container is shut down |
| `discovery:error` | `{ path, error }` | Emitted when an error occurs during discovery |
| `discovery:completed` | `{ type, components }` | Emitted when discovery is completed |
| `shutdown:error` | `{ component, error }` | Emitted when an error occurs during component shutdown |

#### Usage Patterns

##### Dependency Declaration

Components can declare their dependencies using a static `dependencies` property:

```javascript
class UserService {
  static dependencies = ['database', 'logger', 'config'];
  
  constructor(deps) {
    this.database = deps.database;
    this.logger = deps.logger;
    this.config = deps.config;
  }
}
```

##### Initialization Hook

Components can implement an `initialize` method that will be called during container initialization:

```javascript
class DatabaseService {
  constructor(deps) {
    this.config = deps.config;
    this.connection = null;
  }
  
  async initialize() {
    this.connection = await createConnection(this.config.database);
    return this;
  }
}
```

##### Shutdown Hook

Components can implement a `shutdown` method that will be called during container shutdown:

```javascript
class DatabaseService {
  // constructor and initialize...
  
  async shutdown() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    return this;
  }
}
```

---

## Error System API

The Error System provides structured error handling, specialized error types, and framework integration for consistent error management.

### ErrorSystem

Central error handling system that manages error types, handlers, and framework integrations.

#### Constructor

```javascript
import { createErrorSystem } from 'tsmis-core';

const errorSystem = createErrorSystem({ logger });
```

Creates a new error system instance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| deps | Object | Dependencies |
| deps.logger | Object | Logger instance (optional, defaults to console) |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| initialized | boolean | Whether the error system has been initialized |
| handlers | Map | Map of error handlers |
| errorTypes | Map | Map of registered error types |
| integrations | Map | Map of framework integrations |

#### Methods

##### `async initialize()`

Initializes the error system.

**Returns:** `Promise<void>`

**Example:**

```javascript
await errorSystem.initialize();
```

##### `registerHandler(errorType, handler)`

Registers a handler for a specific error type.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| errorType | string | Error type name or '*' for default handler |
| handler | Function | Error handler function |

**Returns:** `void`

**Example:**

```javascript
errorSystem.registerHandler('ValidationError', async (error, context) => {
  console.warn('Validation error:', error.message, context);
});

// Default handler for all unhandled error types
errorSystem.registerHandler('*', async (error, context) => {
  console.error('Unhandled error:', error.message, context);
});
```

##### `async handleError(error, context = {})`

Handles an error using the appropriate registered handler.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| error | Error | Error to handle |
| context | Object | Error context |

**Returns:** `Promise<void>`

**Example:**

```javascript
try {
  await someOperation();
} catch (error) {
  await errorSystem.handleError(error, {
    operation: 'someOperation',
    userId: 123
  });
}
```

##### `createError(type, code, message, details = {}, options = {})`

Creates a new error of the specified type.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Error type name |
| code | string | Error code |
| message | string | Error message |
| details | Object | Additional error details |
| options | Object | Error options |
| options.cause | Error | Original error cause |

**Returns:** `CoreError` - The created error

**Example:**

```javascript
const error = errorSystem.createError(
  'ValidationError',
  'INVALID_EMAIL',
  'Email format is invalid',
  { email: 'invalid-email', field: 'email' }
);

throw error;
```

##### `registerIntegration(framework, options = {})`

Registers a framework integration for error handling.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| framework | Object | Framework instance |
| options | Object | Integration options |

**Returns:** `Object` - The integration instance

**Example:**

```javascript
import Fastify from 'fastify';

const fastify = Fastify();
errorSystem.registerIntegration(fastify);
```

##### `async shutdown()`

Shuts down the error system.

**Returns:** `Promise<void>`

**Example:**

```javascript
await errorSystem.shutdown();
```

### CoreError

Base error class for all custom errors.

#### Constructor

```javascript
import { CoreError } from 'tsmis-core';

const error = new CoreError(code, message, details, options);
```

Creates a new core error.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| code | string | Error code |
| message | string | Error message |
| details | Object | Additional error details (optional) |
| options | Object | Error options (optional) |
| options.cause | Error | Original error cause (optional) |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| name | string | Error name (constructor name) |
| code | string | Error code |
| message | string | Error message |
| details | Object | Additional error details |
| timestamp | string | Error creation timestamp |
| cause | Error | Original error cause (if provided) |

#### Methods

##### `toJSON()`

Converts the error to a JSON object.

**Returns:** `Object` - JSON representation of the error

**Example:**

```javascript
const error = new CoreError('TEST_ERROR', 'Test error message');
const json = error.toJSON();
// {
//   name: 'CoreError',
//   code: 'TEST_ERROR',
//   message: 'Test error message',
//   details: {},
//   timestamp: '2023-03-27T12:34:56.789Z'
// }
```

##### `static fromJSON(data)`

Creates an error instance from JSON data.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| data | Object | JSON error data |

**Returns:** `CoreError` - The created error

**Example:**

```javascript
const errorData = {
  name: 'CoreError',
  code: 'TEST_ERROR',
  message: 'Test error message',
  details: {},
  timestamp: '2023-03-27T12:34:56.789Z'
};

const error = CoreError.fromJSON(errorData);
```

### Specialized Error Types

TSMIS Core provides several specialized error types that extend `CoreError`:

#### `ValidationError`

For validation-related errors (HTTP 400).

```javascript
import { ValidationError } from 'tsmis-core';

throw new ValidationError(
  'INVALID_INPUT',
  'The provided email is invalid',
  { field: 'email', value: 'invalid' }
);
```

#### `AuthError`

For authentication-related errors (HTTP 401).

```javascript
import { AuthError } from 'tsmis-core';

throw new AuthError(
  'INVALID_TOKEN',
  'The provided token is invalid or expired'
);
```

#### `AccessError`

For authorization and access control errors (HTTP 403).

```javascript
import { AccessError } from 'tsmis-core';

throw new AccessError(
  'FORBIDDEN',
  'User does not have permission to access this resource',
  { resource: 'document', userId: 123 }
);
```

#### `ModuleError`

For module system-related errors (HTTP 500).

```javascript
import { ModuleError } from 'tsmis-core';

throw new ModuleError(
  'INITIALIZATION_FAILED',
  'Failed to initialize module',
  { module: 'UserModule' }
);
```

#### `NetworkError`

For network-related errors (HTTP 503).

```javascript
import { NetworkError } from 'tsmis-core';

throw new NetworkError(
  'REQUEST_TIMEOUT',
  'The request to the external API timed out',
  { endpoint: '/users', timeout: 5000 }
);
```

#### `ServiceError`

For service-level errors (HTTP 503).

```javascript
import { ServiceError } from 'tsmis-core';

throw new ServiceError(
  'DATABASE_ERROR',
  'Failed to connect to the database',
  { database: 'users' }
);
```

#### `EventError`

For event system-related errors (HTTP 500).

```javascript
import { EventError } from 'tsmis-core';

throw new EventError(
  'EMISSION_FAILED',
  'Failed to emit event',
  { event: 'user.created' }
);
```

#### `ConfigError`

For configuration-related errors (HTTP 500).

```javascript
import { ConfigError } from 'tsmis-core';

throw new ConfigError(
  'MISSING_REQUIRED',
  'Required configuration value is missing',
  { key: 'database.url' }
);
```

### ErrorCodes

TSMIS Core provides a set of standardized error codes for consistent error identification:

```javascript
import { ErrorCodes } from 'tsmis-core';

throw new ValidationError(
  ErrorCodes.VALIDATION.SCHEMA,
  'Request validation failed'
);
```

Available error code categories:

- `ErrorCodes.CORE`: Generic core errors
- `ErrorCodes.MODULE`: Module-related errors
- `ErrorCodes.EVENT`: Event-related errors
- `ErrorCodes.SERVICE`: Service-related errors
- `ErrorCodes.CONFIG`: Configuration-related errors
- `ErrorCodes.VALIDATION`: Validation-related errors
- `ErrorCodes.NETWORK`: Network-related errors
- `ErrorCodes.AUTH`: Authentication-related errors
- `ErrorCodes.ACCESS`: Authorization-related errors

### Framework Integrations

#### Fastify Integration

TSMIS Core provides a built-in integration with Fastify:

```javascript
import { setupErrorHandler } from 'tsmis-core';
import Fastify from 'fastify';

const fastify = Fastify();

// Set up error handling
setupErrorHandler(fastify);
```

This integration:
- Maps Fastify errors to Core error types
- Provides consistent error serialization
- Handles validation errors automatically
- Sets appropriate HTTP status codes

---

## Event Bus System API

The Event Bus System provides event-driven communication, advanced event handling features, and comprehensive health monitoring.

### EventBusSystem

Central event management system that orchestrates event communication.

#### Constructor

```javascript
import { createEventBusSystem } from 'tsmis-core';

const eventBusSystem = createEventBusSystem({
  errorSystem,
  config: { /* event configuration */ }
});
```

Creates a new event bus system instance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| deps | Object | Dependencies |
| deps.errorSystem | Object | Error system instance (optional) |
| deps.config | Object | Configuration object (optional) |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| initialized | boolean | Whether the system has been initialized |
| eventBus | CoreEventBus | The underlying event bus instance |
| state | Object | System state information |

#### Methods

##### `async initialize()`

Initializes the event bus system.

**Returns:** `Promise<EventBusSystem>` - The initialized system

**Example:**

```javascript
await eventBusSystem.initialize();
```

##### `getEventBus()`

Gets the underlying event bus instance.

**Returns:** `CoreEventBus` - The event bus instance

**Throws:**
- `EventError`: If the system is not initialized

**Example:**

```javascript
const eventBus = eventBusSystem.getEventBus();
```

##### `async emit(eventName, ...args)`

Emits an event.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| eventName | string | Event name |
| ...args | any[] | Event arguments |

**Returns:** `Promise<boolean>` - Whether the event had listeners

**Example:**

```javascript
await eventBusSystem.emit('user.created', { id: 123, name: 'John' });
```

##### `async checkHealth()`

Performs health checks for the event bus system.

**Returns:** `Promise<Object>` - Health check results

**Example:**

```javascript
const health = await eventBusSystem.checkHealth();
console.log(health);
```

##### `registerHealthCheck(name, checkFn)`

Registers a health check function.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Health check name |
| checkFn | Function | Health check function |

**Returns:** `void`

**Example:**

```javascript
eventBusSystem.registerHealthCheck('customCheck', async () => {
  return {
    status: 'healthy',
    details: { /* check details */ }
  };
});
```

##### `recordMetric(name, value, tags = {})`

Records a metric.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Metric name |
| value | any | Metric value |
| tags | Object | Metric tags |

**Returns:** `void`

**Example:**

```javascript
eventBusSystem.recordMetric('events.processed', 42, {
  type: 'user.created'
});
```

##### `getMetrics()`

Gets all recorded metrics.

**Returns:** `Object` - All metrics

**Example:**

```javascript
const metrics = eventBusSystem.getMetrics();
```

##### `getStatus()`

Gets the system status.

**Returns:** `Object` - System status

**Example:**

```javascript
const status = eventBusSystem.getStatus();
```

##### `async shutdown()`

Shuts down the event bus system.

**Returns:** `Promise<EventBusSystem>` - The system instance

**Example:**

```javascript
await eventBusSystem.shutdown();
```

#### Events

The `EventBusSystem` extends `EventEmitter` and emits the following events:

| Event | Payload | Description |
|-------|---------|-------------|
| `system:initialized` | `{ timestamp }` | Emitted when the system is initialized |
| `system:shutdown` | `{ timestamp }` | Emitted when the system is shut down |
| `module:error` | `{ module, error, timestamp }` | Emitted when a module error occurs |
| Various business events | Event-specific | Business events are forwarded from the event bus |

### CoreEventBus

Core event bus that provides advanced event handling features.

#### Constructor

```javascript
import { CoreEventBus } from 'tsmis-core';

const eventBus = new CoreEventBus({
  errorSystem,
  config: {
    eventHistory: {
      maxSize: 1000
    }
  }
});
```

Creates a new event bus instance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| deps | Object | Dependencies |
| deps.errorSystem | Object | Error system instance (optional) |
| deps.config | Object | Configuration object (optional) |
| deps.config.eventHistory | Object | Event history configuration |
| deps.config.eventHistory.maxSize | number | Maximum history size (default: 1000) |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| initialized | boolean | Whether the event bus has been initialized |
| queues | Map | Map of event queues |
| subscriptions | Map | Map of event subscriptions |
| history | Map | Map of event history |
| state | Object | System state information |

#### Methods

##### `async initialize()`

Initializes the event bus.

**Returns:** `Promise<void>`

**Example:**

```javascript
await eventBus.initialize();
```

##### `async emit(eventName, data, options = {})`

Emits an event.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| eventName | string | Event name |
| data | any | Event data |
| options | Object | Emission options |
| options.queue | boolean | Whether to queue the event |
| options.immediate | boolean | Whether to process the queue immediately |
| options.metadata | Object | Additional event metadata |

**Returns:** `Promise<boolean>` - Whether the event had listeners or was queued

**Example:**

```javascript
// Simple event emission
await eventBus.emit('user.created', { id: 123, name: 'John' });

// Queued event
await eventBus.emit('email.send', emailData, { queue: true });

// Queued event with immediate processing
await eventBus.emit('notification.send', notificationData, {
  queue: true,
  immediate: true
});

// Event with metadata
await eventBus.emit('user.created', userData, {
  metadata: {
    source: 'registration',
    ipAddress: '192.168.1.1'
  }
});
```

##### `subscribe(pattern, handler, options = {})`

Subscribes to events matching a pattern.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| pattern | string | Event pattern (can include wildcards) |
| handler | Function | Event handler function |
| options | Object | Subscription options |

**Returns:** `string` - Subscription ID

**Example:**

```javascript
// Subscribe to a specific event
const subId1 = eventBus.subscribe('user.created', (event) => {
  console.log('User created:', event.data);
});

// Subscribe to all user events
const subId2 = eventBus.subscribe('user.*', (event) => {
  console.log(`User event: ${event.name}`, event.data);
});

// Subscribe to all creation events
const subId3 = eventBus.subscribe('*.created', (event) => {
  console.log(`Created: ${event.name}`, event.data);
});

// Subscribe to all events
const subId4 = eventBus.subscribe('*', (event) => {
  console.log(`Event: ${event.name}`, event.data);
});
```

##### `unsubscribe(subscriptionId)`

Unsubscribes from events.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| subscriptionId | string | Subscription ID |

**Returns:** `boolean` - Whether the subscription was removed

**Example:**

```javascript
const subId = eventBus.subscribe('user.created', handleUserCreated);
// Later...
eventBus.unsubscribe(subId);
```

##### `async processQueue(queueName)`

Processes queued events.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| queueName | string | Queue name |

**Returns:** `Promise<number>` - Number of processed events

**Example:**

```javascript
// Process all queued 'email.send' events
const processedCount = await eventBus.processQueue('email.send');
```

##### `async processAllQueues()`

Processes all queued events.

**Returns:** `Promise<Object>` - Processing results

**Example:**

```javascript
// Process all queued events
const results = await eventBus.processAllQueues();
```

##### `getHistory(eventName, options = {})`

Gets event history.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| eventName | string | Event name |
| options | Object | History options |
| options.limit | number | Maximum number of events to return |

**Returns:** `Array` - Event history

**Example:**

```javascript
// Get all history for 'user.created' events
const history = eventBus.getHistory('user.created');

// Get the 10 most recent 'user.created' events
const recentHistory = eventBus.getHistory('user.created', { limit: 10 });
```

##### `getAllHistory(options = {})`

Gets all event history.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| options | Object | History options |
| options.limit | number | Maximum number of events per type |

**Returns:** `Object` - All event history

**Example:**

```javascript
// Get all event history
const allHistory = eventBus.getAllHistory();

// Get the 10 most recent events of each type
const recentHistory = eventBus.getAllHistory({ limit: 10 });
```

##### `async checkHealth()`

Performs health checks for the event bus.

**Returns:** `Promise<Object>` - Health check results

**Example:**

```javascript
const health = await eventBus.checkHealth();
console.log(health);
```

##### `registerHealthCheck(name, checkFn)`

Registers a health check function.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Health check name |
| checkFn | Function | Health check function |

**Returns:** `void`

**Example:**

```javascript
eventBus.registerHealthCheck('customCheck', async () => {
  return {
    status: 'healthy',
    details: { /* check details */ }
  };
});
```

##### `recordMetric(name, value, tags = {})`

Records a metric.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Metric name |
| value | any | Metric value |
| tags | Object | Metric tags |

**Returns:** `void`

**Example:**

```javascript
eventBus.recordMetric('events.processed', 42, {
  type: 'user.created'
});
```

##### `async reset()`

Clears history and queues.

**Returns:** `Promise<void>`

**Example:**

```javascript
await eventBus.reset();
```

##### `async shutdown()`

Shuts down the event bus.

**Returns:** `Promise<void>`

**Example:**

```javascript
await eventBus.shutdown();
```

#### Event Structure

Events emitted by the event bus have the following structure:

```javascript
{
  id: 'event-uuid',           // Unique event identifier
  name: 'user.created',       // Event name
  data: { /* payload */ },    // Event data payload
  timestamp: '2023-03-27T12:34:56.789Z', // Event timestamp
  metadata: { /* metadata */ } // Additional metadata
}
```

---

## Module System API

The Module System provides standardized module management, lifecycle hooks, and health monitoring for business modules.

### ModuleSystem

Central module management system that orchestrates module lifecycle and dependencies.

#### Constructor

```javascript
import { createModuleSystem } from 'tsmis-core';

const moduleSystem = createModuleSystem({
  errorSystem,
  eventBusSystem,
  config: { /* module configuration */ }
});
```

Creates a new module system instance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| deps | Object | Dependencies |
| deps.errorSystem | Object | Error system instance (optional) |
| deps.eventBusSystem | Object | Event bus system instance (optional) |
| deps.config | Object | Configuration object (optional) |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| initialized | boolean | Whether the system has been initialized |
| modules | Map | Map of registered modules |
| state | Object | System state information |

#### Methods

##### `async initialize()`

Initializes the module system and all registered modules.

**Returns:** `Promise<void>`

**Example:**

```javascript
await moduleSystem.initialize();
```

##### `async register(name, ModuleClass, config = {})`

Registers a module.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Module name |
| ModuleClass | Class | Module class (must extend CoreModule) |
| config | Object | Module-specific configuration |

**Returns:** `Promise<CoreModule>` - The registered module instance

**Example:**

```javascript
import { UserModule } from './modules/UserModule.js';

await moduleSystem.register('userModule', UserModule, {
  userCache: { enabled: true, ttl: 3600000 }
});
```

##### `async unregister(name)`

Unregisters a module.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Module name |

**Returns:** `Promise<void>`

**Example:**

```javascript
await moduleSystem.unregister('userModule');
```

##### `async resolve(name)`

Resolves a registered module.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Module name |

**Returns:** `Promise<CoreModule>` - The module instance

**Throws:**
- `ModuleError`: If the module is not registered

**Example:**

```javascript
const userModule = await moduleSystem.resolve('userModule');
const user = await userModule.createUser({ name: 'John', email: 'john@example.com' });
```

##### `resolveDependencyOrder()`

Resolves the dependency order of registered modules.

**Returns:** `Array<string>` - Ordered module names

**Example:**

```javascript
const initOrder = moduleSystem.resolveDependencyOrder();
console.log('Initialization order:', initOrder);
```

##### `async getSystemHealth()`

Gets the health of all modules.

**Returns:** `Promise<Object>` - Health status

**Example:**

```javascript
const health = await moduleSystem.getSystemHealth();
console.log('System health:', health);
```

##### `async shutdown()`

Shuts down the module system and all modules.

**Returns:** `Promise<void>`

**Example:**

```javascript
await moduleSystem.shutdown();
```

#### Events

The `ModuleSystem` extends `EventEmitter` and emits the following events:

| Event | Payload | Description |
|-------|---------|-------------|
| `module:registered` | `{ name, timestamp }` | Emitted when a module is registered |
| `module:unregistered` | `{ name, timestamp }` | Emitted when a module is unregistered |
| `module:error` | `{ module, error, timestamp }` | Emitted when a module error occurs |
| `system:initialized` | `{ timestamp, modules }` | Emitted when the system is initialized |
| `system:shutdown` | `{ timestamp }` | Emitted when the system is shut down |

### CoreModule

Base class for all business modules.

#### Constructor

```javascript
import { CoreModule } from 'tsmis-core';

class UserModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'database'];
  
  constructor(deps) {
    super(deps);
    this.database = deps.database;
  }
}
```

Creates a new module instance.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| deps | Object | Dependencies |
| deps.errorSystem | Object | Error system instance (injected) |
| deps.eventBusSystem | Object | Event bus system instance (injected) |
| deps.config | Object | Configuration object (injected) |
| deps.* | Object | Other dependencies as specified in static dependencies |

#### Static Properties

| Property | Type | Description |
|----------|------|-------------|
| dependencies | string[] | Array of dependency names |
| version | string | Module version |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| initialized | boolean | Whether the module has been initialized |
| deps | Object | Injected dependencies |
| eventBus | Object | Event bus instance (from eventBusSystem) |
| config | Object | Module configuration |
| state | Object | Module state information |

#### Methods

##### `async initialize()`

Initializes the module.

**Returns:** `Promise<CoreModule>` - The module instance

**Example:**

```javascript
const userModule = new UserModule(deps);
await userModule.initialize();
```

##### `async validateConfig()`

Validates the module configuration.

**Returns:** `Promise<boolean>` - Validation result

**Example:**

```javascript
await userModule.validateConfig();
```

##### `async emit(eventName, ...args)`

Emits an event.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| eventName | string | Event name |
| ...args | any[] | Event arguments |

**Returns:** `Promise<boolean>` - Whether the event had listeners

**Example:**

```javascript
await userModule.emit('user.created', { id: 123, name: 'John' });
```

##### `async handleError(error, context = {})`

Handles an error with context.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| error | Error | Error to handle |
| context | Object | Error context |

**Returns:** `Promise<CoreModule>` - The module instance

**Example:**

```javascript
try {
  await someOperation();
} catch (error) {
  await userModule.handleError(error, {
    operation: 'someOperation',
    userId: 123
  });
}
```

##### `async checkHealth()`

Performs module health checks.

**Returns:** `Promise<Object>` - Health check results

**Example:**

```javascript
const health = await userModule.checkHealth();
console.log('Module health:', health);
```

##### `registerHealthCheck(name, checkFn)`

Registers a health check function.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Health check name |
| checkFn | Function | Health check function |

**Returns:** `void`

**Example:**

```javascript
userModule.registerHealthCheck('database', async () => {
  const connected = await userModule.database.testConnection();
  return {
    status: connected ? 'healthy' : 'unhealthy',
    details: { connected }
  };
});
```

##### `recordMetric(name, value, tags = {})`

Records a metric.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Metric name |
| value | any | Metric value |
| tags | Object | Metric tags |

**Returns:** `void`

**Example:**

```javascript
userModule.recordMetric('users.created', 1, {
  source: 'api'
});
```

##### `async shutdown()`

Shuts down the module.

**Returns:** `Promise<CoreModule>` - The module instance

**Example:**

```javascript
await userModule.shutdown();
```

#### Lifecycle Hooks

The `CoreModule` provides several lifecycle hooks that can be overridden by derived classes:

##### `async onValidateConfig()`

Called during configuration validation.

**Returns:** `Promise<boolean>` - Validation result

**Example:**

```javascript
class UserModule extends CoreModule {
  async onValidateConfig() {
    if (!this.config.userRoles) {
      throw new ValidationError('MISSING_CONFIG', 'User roles must be specified');
    }
    return true;
  }
}
```

##### `async onConfigure()`

Called during module configuration.

**Returns:** `Promise<void>`

**Example:**

```javascript
class UserModule extends CoreModule {
  async onConfigure() {
    this.userCache = new Map();
    this.cacheEnabled = this.config.userCache?.enabled || false;
    this.cacheTTL = this.config.userCache?.ttl || 3600000;
  }
}
```

##### `async setupEventHandlers()`

Called to set up event handlers.

**Returns:** `Promise<void>`

**Example:**

```javascript
class UserModule extends CoreModule {
  async setupEventHandlers() {
    this.subscriptions = [
      this.eventBus.subscribe('user.created', this.handleUserCreated.bind(this)),
      this.eventBus.subscribe('user.updated', this.handleUserUpdated.bind(this))
    ];
  }
  
  async handleUserCreated(event) {
    // Handle user created event
  }
  
  async handleUserUpdated(event) {
    // Handle user updated event
  }
}
```

##### `async onSetupHealthChecks()`

Called to set up module-specific health checks.

**Returns:** `Promise<void>`

**Example:**

```javascript
class UserModule extends CoreModule {
  async onSetupHealthChecks() {
    this.registerHealthCheck('cache', async () => {
      return {
        status: 'healthy',
        size: this.userCache.size,
        enabled: this.cacheEnabled
      };
    });
  }
}
```

##### `async onInitialize()`

Called during module initialization.

**Returns:** `Promise<void>`

**Example:**

```javascript
class UserModule extends CoreModule {
  async onInitialize() {
    await this.database.ensureUserTable();
    this.initialized = true;
  }
}
```

##### `async onShutdown()`

Called during module shutdown.

**Returns:** `Promise<void>`

**Example:**

```javascript
class UserModule extends CoreModule {
  async onShutdown() {
    // Clean up resources
    this.userCache.clear();
    
    // Clean up event subscriptions
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
  }
}
```

#### Events

The `CoreModule` extends `EventEmitter` and emits the following events:

| Event | Payload | Description |
|-------|---------|-------------|
| `module:initialized` | `{ name, timestamp }` | Emitted when the module is initialized |
| `module:error` | `{ module, error, context }` | Emitted when a module error occurs |
| `module:shutdown` | `{ name, timestamp }` | Emitted when the module is shut down |

---

## Integration Patterns

This section provides common patterns and examples for integrating TSMIS Core into your applications.

### Application Bootstrap

This pattern shows how to bootstrap a TSMIS Core application:

```javascript
// src/app.js
import { CoreContainer } from 'tsmis-core';
import {
  createErrorSystem,
  createEventBusSystem,
  createModuleSystem
} from 'tsmis-core';
import Fastify from 'fastify';
import { setupErrorHandler } from 'tsmis-core';

// Import modules
import { UserModule } from './modules/user/UserModule.js';
import { OrderModule } from './modules/order/OrderModule.js';
import { ApiModule } from './modules/api/ApiModule.js';

// Import services
import { DatabaseService } from './services/DatabaseService.js';
import { ConfigService } from './services/ConfigService.js';

export async function buildApp() {
  // Create container
  const container = new CoreContainer();
  
  // Register services
  container.register('config', () => new ConfigService());
  container.register('database', DatabaseService);
  
  // Register core systems
  container.register('errorSystem', createErrorSystem);
  container.register('eventBusSystem', createEventBusSystem);
  container.register('moduleSystem', createModuleSystem);
  
  // Create Fastify instance
  const fastify = Fastify({
    logger: true
  });
  
  // Register Fastify instance
  container.register('fastify', fastify);
  
  // Set up Fastify error handling
  setupErrorHandler(fastify);
  
  // Initialize the container
  await container.initialize();
  
  // Get module system
  const moduleSystem = await container.resolve('moduleSystem');
  
  // Register business modules
  await moduleSystem.register('userModule', UserModule);
  await moduleSystem.register('orderModule', OrderModule);
  await moduleSystem.register('apiModule', ApiModule);
  
  // Initialize modules
  await moduleSystem.initialize();
  
  // Export container reference for access in routes
  fastify.decorate('container', container);
  
  // Basic route as a health check
  fastify.get('/', async (request, reply) => {
    const health = await moduleSystem.getSystemHealth();
    return {
      status: health.status,
      timestamp: new Date().toISOString()
    };
  });
  
  // Set up graceful shutdown
  const closeHandler = async () => {
    try {
      await fastify.close();
      await container.shutdown();
    } catch (error) {
      console.error('Shutdown error:', error);
    }
  };
  
  // Handle shutdown signals
  process.on('SIGINT', closeHandler);
  process.on('SIGTERM', closeHandler);
  
  return fastify;
}

// Server entry point
if (require.main === module) {
  buildApp()
    .then(app => {
      app.listen({ port: 3000 }, (err) => {
        if (err) {
          console.error('Server start error:', err);
          process.exit(1);
        }
      });
    })
    .catch(err => {
      console.error('Application build error:', err);
      process.exit(1);
    });
}
```

### API Module Pattern

This pattern shows how to create an API module that exposes HTTP endpoints:

```javascript
// modules/api/ApiModule.js
import { CoreModule } from 'tsmis-core';
import { ValidationError } from 'tsmis-core';

export class ApiModule extends CoreModule {
  static dependencies = [
    'errorSystem',
    'eventBusSystem',
    'config',
    'fastify',
    'userModule',
    'orderModule'
  ];
  
  constructor(deps) {
    super(deps);
    this.fastify = deps.fastify;
    this.userModule = deps.userModule;
    this.orderModule = deps.orderModule;
  }
  
  async onInitialize() {
    this.registerRoutes();
  }
  
  registerRoutes() {
    // User routes
    this.fastify.get('/api/users', this.getUsers.bind(this));
    this.fastify.get('/api/users/:id', this.getUserById.bind(this));
    this.fastify.post('/api/users', this.createUser.bind(this));
    
    // Order routes
    this.fastify.get('/api/orders', this.getOrders.bind(this));
    this.fastify.post('/api/orders', this.createOrder.bind(this));
  }
  
  // Route handlers
  async getUsers(request, reply) {
    try {
      const users = await this.userModule.getUsers();
      return users;
    } catch (error) {
      await this.handleError(error, {
        route: 'getUsers',
        query: request.query
      });
      throw error;
    }
  }
  
  async getUserById(request, reply) {
    try {
      const user = await this.userModule.getUserById(request.params.id);
      if (!user) {
        throw new ValidationError(
          'NOT_FOUND',
          'User not found',
          { userId: request.params.id }
        );
      }
      return user;
    } catch (error) {
      await this.handleError(error, {
        route: 'getUserById',
        userId: request.params.id
      });
      throw error;
    }
  }
  
  async createUser(request, reply) {
    try {
      const user = await this.userModule.createUser(request.body);
      reply.code(201);
      return user;
    } catch (error) {
      await this.handleError(error, {
        route: 'createUser',
        body: request.body
      });
      throw error;
    }
  }
  
  async getOrders(request, reply) {
    try {
      const orders = await this.orderModule.getOrders({
        userId: request.query.userId
      });
      return orders;
    } catch (error) {
      await this.handleError(error, {
        route: 'getOrders',
        query: request.query
      });
      throw error;
    }
  }
  
  async createOrder(request, reply) {
    try {
      const order = await this.orderModule.createOrder(request.body);
      reply.code(201);
      return order;
    } catch (error) {
      await this.handleError(error, {
        route: 'createOrder',
        body: request.body
      });
      throw error;
    }
  }
  
  async onShutdown() {
    // Any cleanup needed
  }
}
```

### Business Module Pattern

This pattern shows how to create a business module:

```javascript
// modules/user/UserModule.js
import { CoreModule } from 'tsmis-core';
import { ValidationError } from 'tsmis-core';

export class UserModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'database'];
  static version = '1.0.0';
  
  constructor(deps) {
    super(deps);
    this.database = deps.database;
    this.subscriptions = [];
    this.userCache = new Map();
  }
  
  async onValidateConfig() {
    // Validate required configuration
    if (!this.config.userRoles) {
      throw new ValidationError(
        'MISSING_CONFIG',
        'User roles configuration is required'
      );
    }
    return true;
  }
  
  async onConfigure() {
    // Initialize module state
    this.userRoles = this.config.userRoles;
    this.cacheEnabled = this.config.cache?.enabled || false;
    this.cacheTTL = this.config.cache?.ttl || 3600000;
  }
  
  async setupEventHandlers() {
    this.subscriptions = [
      this.eventBus.subscribe('user.created', this.handleUserCreated.bind(this)),
      this.eventBus.subscribe('user.updated', this.handleUserUpdated.bind(this)),
      this.eventBus.subscribe('user.deleted', this.handleUserDeleted.bind(this)),
      this.eventBus.subscribe('cache.clear', this.handleCacheClear.bind(this))
    ];
  }
  
  async onSetupHealthChecks() {
    this.registerHealthCheck('cache', async () => {
      return {
        status: 'healthy',
        size: this.userCache.size,
        enabled: this.cacheEnabled
      };
    });
    
    this.registerHealthCheck('database', async () => {
      try {
        await this.database.query('SELECT 1');
        return {
          status: 'healthy',
          details: { connected: true }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });
  }
  
  async onInitialize() {
    // Set up database tables
    await this.database.ensureTable('users', {
      id: 'uuid',
      name: 'string',
      email: 'string',
      role: 'string',
      created_at: 'timestamp'
    });
    
    // Record metric
    this.recordMetric('module.initialized', 1, {
      name: 'userModule'
    });
  }
  
  // Public API methods
  async getUsers() {
    try {
      const users = await this.database.query('SELECT * FROM users');
      return users;
    } catch (error) {
      await this.handleError(error, {
        method: 'getUsers'
      });
      throw error;
    }
  }
  
  async getUserById(id) {
    try {
      // Check cache first
      if (this.cacheEnabled && this.userCache.has(id)) {
        const cached = this.userCache.get(id);
        if (cached.expires > Date.now()) {
          this.recordMetric('cache.hit', 1, {
            method: 'getUserById'
          });
          return cached.data;
        }
      }
      
      const user = await this.database.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      
      if (user && this.cacheEnabled) {
        this.userCache.set(id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
      
      return user;
    } catch (error) {
      await this.handleError(error, {
        method: 'getUserById',
        userId: id
      });
      throw error;
    }
  }
  
  async createUser(userData) {
    try {
      // Validate user data
      if (!userData.email) {
        throw new ValidationError(
          'MISSING_EMAIL',
          'Email is required',
          { field: 'email' }
        );
      }
      
      if (!userData.name) {
        throw new ValidationError(
          'MISSING_NAME',
          'Name is required',
          { field: 'name' }
        );
      }
      
      // Check if user already exists
      const existing = await this.database.query(
        'SELECT * FROM users WHERE email = $1',
        [userData.email]
      );
      
      if (existing && existing.length > 0) {
        throw new ValidationError(
          'DUPLICATE_EMAIL',
          'Email already exists',
          { field: 'email', value: userData.email }
        );
      }
      
      // Assign default role if not specified
      if (!userData.role) {
        userData.role = this.userRoles[0];
      }
      
      // Create user
      const user = await this.database.query(
        'INSERT INTO users (name, email, role, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [userData.name, userData.email, userData.role, new Date()]
      );
      
      // Update cache
      if (this.cacheEnabled) {
        this.userCache.set(user.id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
      
      // Emit event
      await this.emit('user.created', user);
      
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
      // Handle user created event
      const user = event.data;
      
      // Update cache if event came from elsewhere
      if (this.cacheEnabled && event.metadata?.source !== this.id) {
        this.userCache.set(user.id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
    } catch (error) {
      await this.handleError(error, {
        handler: 'handleUserCreated',
        event
      });
    }
  }
  
  async handleUserUpdated(event) {
    try {
      // Update cache
      if (this.cacheEnabled) {
        const user = event.data;
        this.userCache.set(user.id, {
          data: user,
          expires: Date.now() + this.cacheTTL
        });
      }
    } catch (error) {
      await this.handleError(error, {
        handler: 'handleUserUpdated',
        event
      });
    }
  }
  
  async handleUserDeleted(event) {
    try {
      // Remove from cache
      if (this.cacheEnabled) {
        this.userCache.delete(event.data.id);
      }
    } catch (error) {
      await this.handleError(error, {
        handler: 'handleUserDeleted',
        event
      });
    }
  }
  
  async handleCacheClear(event) {
    try {
      if (event.data.target === 'all' || event.data.target === 'users') {
        this.userCache.clear();
        this.recordMetric('cache.cleared', 1, {
          target: 'users'
        });
      }
    } catch (error) {
      await this.handleError(error, {
        handler: 'handleCacheClear',
        event
      });
    }
  }
  
  async onShutdown() {
    // Clean up event subscriptions
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    
    // Clear cache
    this.userCache.clear();
  }
}
```

### Database Service Pattern

This pattern shows how to create a database service:

```javascript
// services/DatabaseService.js
import pg from 'pg';

export class DatabaseService {
  static dependencies = ['config'];
  
  constructor(deps) {
    this.config = deps.config;
    this.pool = null;
  }
  
  async initialize() {
    const dbConfig = this.config.database;
    
    this.pool = new pg.Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      max: dbConfig.poolSize || 10,
      idleTimeoutMillis: 30000
    });
    
    // Test connection
    try {
      await this.query('SELECT 1');
      console.log('Database connection established');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
    
    return this;
  }
  
  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  async ensureTable(tableName, schema) {
    const columnDefinitions = Object.entries(schema)
      .map(([column, type]) => {
        let sqlType;
        switch (type) {
          case 'uuid':
            sqlType = 'UUID';
            break;
          case 'string':
            sqlType = 'TEXT';
            break;
          case 'number':
            sqlType = 'NUMERIC';
            break;
          case 'integer':
            sqlType = 'INTEGER';
            break;
          case 'boolean':
            sqlType = 'BOOLEAN';
            break;
          case 'timestamp':
            sqlType = 'TIMESTAMP WITH TIME ZONE';
            break;
          case 'json':
            sqlType = 'JSONB';
            break;
          default:
            sqlType = 'TEXT';
        }
        return `${column} ${sqlType}`;
      })
      .join(', ');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnDefinitions},
        PRIMARY KEY (id)
      )
    `;
    
    await this.query(sql);
  }
  
  async shutdown() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
```

### Testing Pattern

This pattern shows how to test a module following TSMIS Core's test-driven approach:

```javascript
/**
 * TESTS
 *
 * The tests are organized into the following sections:
 * - Initialization: Tests for proper module initialization
 * - User Management: Tests for user creation, validation, and retrieval
 * - Event Handling: Tests for proper event emission and handling
 * - Cache Management: Tests for caching behavior
 * - Error Handling: Tests for error propagation through systems
 * - Lifecycle Management: Tests for shutdown and cleanup
 */

// tests/modules/UserModule.test.js
import { CoreContainer } from 'tsmis-core';
import { 
  createErrorSystem, 
  createEventBusSystem, 
  createModuleSystem,
  ValidationError,
  ModuleError,
  ErrorCodes
} from 'tsmis-core';
import { UserModule } from '../../src/modules/user/UserModule.js';
import { DatabaseService } from '../../src/services/DatabaseService.js';

describe('UserModule', () => {
  let container;
  let errorSystem;
  let eventBusSystem;
  let moduleSystem;
  let userModule;
  let capturedEvents = [];
  let eventSubscriptionId;
  
  // Mock the database for external dependency
  const mockDatabase = {
    query: async (sql, params) => {
      if (sql === 'SELECT * FROM users WHERE email = $1' && params?.[0] === 'test@example.com') {
        return []; // No existing user with this email
      } else if (sql === 'SELECT * FROM users WHERE email = $1' && params?.[0] === 'existing@example.com') {
        return [{ id: '123', email: 'existing@example.com' }]; // Existing user
      } else if (sql.includes('INSERT INTO users')) {
        return {
          id: '123',
          name: params[0],
          email: params[1],
          role: params[2],
          created_at: params[3]
        };
      } else if (sql === 'SELECT * FROM users WHERE id = $1' && params?.[0] === '123') {
        return {
          id: '123',
          name: 'Test User',
          email: 'test@example.com'
        };
      }
      return [];
    },
    ensureTable: async () => true
  };
  
  beforeEach(async () => {
    // Reset tracking
    capturedEvents = [];
    
    // Create a test configuration
    const testConfig = {
      userRoles: ['admin', 'user'],
      cache: { 
        enabled: true,
        ttl: 60000 
      }
    };
    
    // Create container with real implementations
    container = new CoreContainer();
    container.register('errorSystem', createErrorSystem);
    container.register('config', () => testConfig);
    container.register('eventBusSystem', createEventBusSystem);
    container.register('moduleSystem', createModuleSystem);
    container.register('database', () => mockDatabase);
    
    // Initialize container
    await container.initialize();
    
    // Resolve core systems
    errorSystem = await container.resolve('errorSystem');
    eventBusSystem = await container.resolve('eventBusSystem');
    moduleSystem = await container.resolve('moduleSystem');
    
    // Setup event tracking using the real event bus
    const eventBus = eventBusSystem.getEventBus();
    eventSubscriptionId = eventBus.subscribe('*', (event) => {
      capturedEvents.push(event);
    });
    
    // Register and initialize the UserModule
    await moduleSystem.register('userModule', UserModule);
    await moduleSystem.initialize();
    
    // Resolve the user module
    userModule = await moduleSystem.resolve('userModule');
  });
  
  afterEach(async () => {
    // Clean up event subscription
    if (eventBusSystem?.initialized) {
      const eventBus = eventBusSystem.getEventBus();
      eventBus.unsubscribe(eventSubscriptionId);
    }
    
    // Shutdown container
    if (container?.initialized) {
      await container.shutdown();
    }
  });
  
  // INITIALIZATION
  describe('initialization', () => {
    test('should initialize successfully', () => {
      // Verify module is initialized
      expect(userModule.initialized).toEqual(true);
      expect(userModule.state.status).toEqual('running');
      
      // Verify configuration is applied
      expect(userModule.userRoles).toEqual(['admin', 'user']);
      expect(userModule.cacheEnabled).toEqual(true);
      
      // Verify initialization events
      const initEvents = capturedEvents.filter(e => e.name === 'module:initialized');
      expect(initEvents.length).toBeGreaterThan(0);
    });
  });
  
  // USER MANAGEMENT
  describe('user management', () => {
    test('should create a user successfully', async () => {
      // Create a user
      const userData = { name: 'Test User', email: 'test@example.com' };
      const user = await userModule.createUser(userData);
      
      // Verify user was created
      expect(user.id).toEqual('123');
      expect(user.name).toEqual('Test User');
      expect(user.email).toEqual('test@example.com');
      
      // Verify events were emitted
      const userEvents = capturedEvents.filter(e => e.name === 'user.created');
      expect(userEvents.length).toEqual(1);
      expect(userEvents[0].data.id).toEqual('123');
      expect(userEvents[0].data.email).toEqual('test@example.com');
    });
    
    test('should validate required fields', async () => {
      // Try to create a user with missing email
      const userData = { name: 'Test User' };
      
      try {
        await userModule.createUser(userData);
        // Should not reach this point
        expect('Should have thrown error').toEqual(false);
      } catch (error) {
        // Verify error type and message
        expect(error instanceof ValidationError).toEqual(true);
        expect(error.message).toContain('Email is required');
        
        // Verify error was handled by error system
        const errorEvents = capturedEvents.filter(e => e.name === 'module:error');
        expect(errorEvents.length).toBeGreaterThan(0);
      }
    });
    
    test('should prevent duplicate emails', async () => {
      // Try to create a user with an existing email
      const userData = { name: 'Test User', email: 'existing@example.com' };
      
      try {
        await userModule.createUser(userData);
        // Should not reach this point
        expect('Should have thrown error').toEqual(false);
      } catch (error) {
        // Verify error type and message
        expect(error instanceof ValidationError).toEqual(true);
        expect(error.message).toContain('Email already exists');
        
        // Verify no user.created events were emitted
        const userEvents = capturedEvents.filter(e => e.name === 'user.created');
        expect(userEvents.length).toEqual(0);
      }
    });
    
    test('should retrieve a user by ID', async () => {
      // Get a user by ID
      const user = await userModule.getUserById('123');
      
      // Verify user was retrieved
      expect(user.id).toEqual('123');
      expect(user.name).toEqual('Test User');
      expect(user.email).toEqual('test@example.com');
    });
  });
  
  // CACHING
  describe('caching', () => {
    test('should use cache when available', async () => {
      // Set up cache with test data
      const cachedUser = {
        id: '456',
        name: 'Cached User',
        email: 'cached@example.com'
      };
      
      userModule.userCache.set('456', {
        data: cachedUser,
        expires: Date.now() + 60000
      });
      
      // Get user from cache
      const user = await userModule.getUserById('456');
      
      // Verify cached data was returned
      expect(user.id).toEqual('456');
      expect(user.name).toEqual('Cached User');
    });
    
    test('should update cache on user.created event', async () => {
      // Get event bus
      const eventBus = eventBusSystem.getEventBus();
      
      // Create test user data
      const userData = {
        id: '789',
        name: 'Event User',
        email: 'event@example.com'
      };
      
      // Emit user.created event
      await eventBus.emit('user.created', userData);
      
      // Verify cache was updated
      expect(userModule.userCache.has('789')).toEqual(true);
      const cached = userModule.userCache.get('789');
      expect(cached.data.name).toEqual('Event User');
    });
    
    test('should clear cache on cache.clear event', async () => {
      // Set up cache with test data
      userModule.userCache.set('test-id', {
        data: { id: 'test-id' },
        expires: Date.now() + 60000
      });
      
      // Verify cache has data
      expect(userModule.userCache.size).toBeGreaterThan(0);
      
      // Get event bus
      const eventBus = eventBusSystem.getEventBus();
      
      // Emit cache.clear event
      await eventBus.emit('cache.clear', { target: 'users' });
      
      // Verify cache was cleared
      expect(userModule.userCache.size).toEqual(0);
    });
  });
  
  // ERROR HANDLING
  describe('error handling', () => {
    test('should properly handle and propagate errors', async () => {
      // Create a database error scenario
      const originalQuery = mockDatabase.query;
      mockDatabase.query = async () => {
        throw new Error('Database connection failed');
      };
      
      try {
        // Try to create a user
        await userModule.createUser({ name: 'Test User', email: 'test@example.com' });
        // Should not reach this point
        expect('Should have thrown error').toEqual(false);
      } catch (error) {
        // Verify error propagation
        expect(error.message).toContain('Database connection failed');
        
        // Verify error events
        const errorEvents = capturedEvents.filter(e => e.name === 'module:error');
        expect(errorEvents.length).toBeGreaterThan(0);
        expect(errorEvents[0].data.error.message).toContain('Database connection failed');
      } finally {
        // Restore original query function
        mockDatabase.query = originalQuery;
      }
    });
  });
  
  // LIFECYCLE
  describe('lifecycle', () => {
    test('should properly clean up on shutdown', async () => {
      // Set up cache with test data
      userModule.userCache.set('test-id', {
        data: { id: 'test-id' },
        expires: Date.now() + 60000
      });
      
      // Create tracking for onShutdown method
      let shutdownCalled = false;
      const originalShutdown = userModule.onShutdown;
      userModule.onShutdown = async function() {
        shutdownCalled = true;
        return await originalShutdown.call(this);
      };
      
      try {
        // Shut down the module
        await userModule.shutdown();
        
        // Verify shutdown was called
        expect(shutdownCalled).toEqual(true);
        
        // Verify state is updated
        expect(userModule.state.status).toEqual('shutdown');
        expect(userModule.initialized).toEqual(false);
        
        // Verify cache is cleared
        expect(userModule.userCache.size).toEqual(0);
        
        // Verify shutdown events
        const shutdownEvents = capturedEvents.filter(e => e.name === 'module:shutdown');
        expect(shutdownEvents.length).toBeGreaterThan(0);
      } finally {
        // Restore original method
        userModule.onShutdown = originalShutdown;
      }
    });
  });
});
```

---

## API Stability and Versioning

TSMIS Core follows semantic versioning (SemVer) for its APIs. This section clarifies the API stability guarantees and versioning strategy.

### Versioning Strategy

- **Major versions** (e.g., 1.x.x to 2.0.0): May include breaking changes to public APIs.
- **Minor versions** (e.g., 1.1.0 to 1.2.0): Add new features without breaking existing functionality.
- **Patch versions** (e.g., 1.1.1 to 1.1.2): Bug fixes and internal improvements without API changes.

### API Stability Levels

Each API in TSMIS Core has a stability level:

- **Stable**: Fully supported, will not change in incompatible ways without a major version increase.
- **Experimental**: May change in incompatible ways in minor version updates.
- **Deprecated**: Still works but will be removed in a future version; alternatives are provided.
- **Internal**: Not meant for public use; may change at any time.

### Stable APIs

The following APIs are considered stable:

- CoreContainer public methods (register, resolve, initialize, shutdown)
- ErrorSystem public methods (handleError, createError, registerHandler)
- CoreError and specialized error types
- EventBusSystem public methods (getEventBus, emit, checkHealth)
- CoreEventBus public methods (emit, subscribe, unsubscribe, getHistory)
- ModuleSystem public methods (register, resolve, initialize, shutdown)
- CoreModule base class and lifecycle hooks

### Experimental APIs

The following APIs are considered experimental:

- Container manifest registration and discovery
- Event queue management (queueEvent, processQueue)
- Advanced pattern matching in event subscriptions
- Health monitoring and metrics recording

### Deprecated APIs

There are currently no deprecated APIs in TSMIS Core.

### Internal APIs

The following should be considered internal implementation details:

- underscore-prefixed methods (e.g., _setupWildcardForwarding)
- private class properties
- internal event emission

### Backward Compatibility

When transitioning between versions:

1. **Major Versions**: May introduce breaking changes; migration guides will be provided.
2. **Minor Versions**: Maintain backward compatibility; old APIs will continue to work.
3. **Patch Versions**: Fix bugs without changing behavior; drop-in replacements.

### Version Support Policy

- Each major version is actively maintained for 12 months after the next major version is released.
- Security updates are provided for 18 months after the initial release.
- LTS (Long Term Support) versions may have extended support timelines.