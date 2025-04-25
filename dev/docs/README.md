# TSMIS Core Runtime

> A modern, test-driven, event-centric, enterprise-grade runtime for building modular Node.js applications.

![TSMIS Core Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ What is TSMIS Core?

**TSMIS Core Runtime** is the foundational framework for building robust, scalable, and fully modular applications in Node.js. It is designed with the principles of:

- **Dependency Injection (DI)**: Automatic resolution of component dependencies
- **Event-Driven Architecture**: Loosely coupled communication between modules
- **Health Monitoring & Metrics**: Comprehensive system observability
- **Structured Error Handling**: Standardized error types with context preservation
- **High Test Coverage (Line & Branch)**: Reliable, thoroughly tested components

TSMIS enables organizations to build large-scale systems with plug-and-play modules like CRM, HR, Scheduling, Forms, Inventory, and more. Its focus on modularity allows teams to work independently on different business domains while maintaining consistency through standardized interfaces.

---

## 🚀 Quick Start Guide

Get started with TSMIS Core in minutes:

```bash
# Install the package
npm install tsmis-core

# Create an app.js file
touch app.js
```

```javascript
// app.js
import { CoreContainer } from 'tsmis-core';
import { createErrorSystem, createEventBusSystem, createModuleSystem } from 'tsmis-core';
import { UserModule } from './modules/UserModule.js';

async function bootstrap() {
  // Create container
  const container = new CoreContainer();
  
  // Register core systems
  container.register('errorSystem', createErrorSystem);
  container.register('config', () => ({ appName: 'MyApp' }));
  container.register('eventBusSystem', createEventBusSystem);
  container.register('moduleSystem', createModuleSystem);
  
  // Initialize container
  await container.initialize();
  
  // Get module system
  const moduleSystem = await container.resolve('moduleSystem');
  
  // Register business module
  await moduleSystem.register('userModule', UserModule);
  
  // Initialize modules
  await moduleSystem.initialize();
  
  console.log('Application started successfully!');
  return container;
}

bootstrap().catch(console.error);
```

---

## 🧱 Architecture Overview

TSMIS Core is built on a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Business Modules                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ UserModule  │  │ OrderModule │  │ InventoryModule     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Module System                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ErrorSystem │  │ EventSystem │  │ Container System    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Core Systems

TSMIS Core consists of the following key components:

### 1. **CoreContainer**

A sophisticated dependency injection container that handles component registration, dependency resolution, and lifecycle management:

```javascript
// Register components
container.register('database', DatabaseService);
container.register('logger', LoggerService);

// Resolve with automatic dependency injection
const database = await container.resolve('database');
```

Key features:
- Singleton and transient component support
- Automatic dependency resolution
- Lifecycle management (initialize, shutdown)
- Circular dependency detection
- Event-based component tracking

### 2. **EventBusSystem / CoreEventBus**

A powerful event bus that enables loosely coupled communication between modules:

```javascript
// Get the event bus
const eventBus = eventBusSystem.getEventBus();

// Subscribe to events
eventBus.subscribe('user.created', handleUserCreated);
eventBus.subscribe('order.*', handleAllOrderEvents);

// Emit events
await eventBus.emit('user.created', { id: 123, name: 'John Doe' });
```

Key features:
- Wildcard event listeners (`user.*`, `*.created`, `*`)
- Event history tracking for debugging
- Queued event processing for background handling
- Metrics recording and monitoring
- Health checks and status reporting

### 3. **ErrorSystem**

Standardized, namespaced error handling with contextual metadata:

```javascript
// Create specific error types
throw new ValidationError('INVALID_INPUT', 'Email is not valid', {
  field: 'email',
  value: 'invalid-email'
});

// Handle errors with context
try {
  await someOperation();
} catch (error) {
  await errorSystem.handleError(error, {
    operation: 'userRegistration',
    userId: user.id
  });
}
```

Key features:
- Specialized error types (ValidationError, AuthError, etc.)
- Error cause chaining
- Contextual error metadata
- Framework integration (Fastify, etc.)
- Environment-aware serialization

### 4. **Module & ModuleSystem**

A standardized approach to creating, managing, and connecting application components:

```javascript
// Define a module
class UserModule extends CoreModule {
  static dependencies = ['database', 'eventBusSystem'];
  
  async setupEventHandlers() {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    this.subscriptions = [
      eventBus.subscribe('user.created', this.handleUserCreated.bind(this))
    ];
  }
  
  async createUser(userData) {
    const user = await this.deps.database.users.create(userData);
    await this.emit('user.created', user);
    return user;
  }
}

// Register the module
await moduleSystem.register('userModule', UserModule);
```

Key features:
- Standardized lifecycle hooks
- Automatic dependency injection
- Health monitoring
- Event-based communication
- Clean resource management

---

## 🔄 Module Communication

Business modules in TSMIS communicate primarily through events, creating a loosely coupled architecture. Here's how modules interact:

### Event-Based Communication

```javascript
// In UserModule.js
class UserModule extends CoreModule {
  // ... other code
  
  async createUser(userData) {
    // Create the user
    const user = await this.deps.database.users.create(userData);
    
    // Emit event for other modules to respond to
    await this.emit('user.created', user);
    
    return user;
  }
}

// In NotificationModule.js
class NotificationModule extends CoreModule {
  // ... other code
  
  async setupEventHandlers() {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    // Subscribe to user.created events
    this.subscriptions = [
      eventBus.subscribe('user.created', this.sendWelcomeEmail.bind(this))
    ];
  }
  
  async sendWelcomeEmail(event) {
    const user = event.data;
    await this.emailService.send({
      to: user.email,
      subject: 'Welcome to our platform!',
      template: 'welcome-email',
      data: { user }
    });
  }
}
```

### Communication Flow Diagram

```
┌─────────────┐                 ┌─────────────────┐
│ UserModule  │                 │ NotificationModule │
└───────┬─────┘                 └─────────┬─────────┘
        │                                 │
        │ emit('user.created')           │
        │─────────────────────────┐      │
        │                         ▼      │
        │                 ┌───────────────────┐
        │                 │   EventBusSystem  │
        │                 └─────────┬─────────┘
        │                           │
        │                           │ notify subscribers
        │                           │
        │                           ▼
        │                 ┌─────────────────┐
        │                 │ sendWelcomeEmail │
        └────────────────►│    function     │
                          └─────────────────┘
```

### Advanced Pattern: Request-Response

While events are one-way communications, you can implement request-response patterns:

```javascript
// In module A: Send request and await response
async function getUserDetails(userId) {
  // Generate a unique correlation ID
  const correlationId = crypto.randomUUID();
  
  // Create a promise that will resolve when the response is received
  const responsePromise = new Promise((resolve, reject) => {
    // Set up a one-time listener for the response
    const subId = this.eventBus.subscribe(`user.details.response.${correlationId}`, (event) => {
      // Unsubscribe immediately
      this.eventBus.unsubscribe(subId);
      resolve(event.data);
    });
    
    // Set a timeout to avoid hanging
    setTimeout(() => {
      this.eventBus.unsubscribe(subId);
      reject(new Error('Request timed out'));
    }, 5000);
  });
  
  // Emit the request event
  await this.eventBus.emit('user.details.request', {
    userId,
    correlationId
  });
  
  // Wait for the response
  return responsePromise;
}

// In module B: Handle request and send response
async setupEventHandlers() {
  this.eventBus.subscribe('user.details.request', async (event) => {
    const { userId, correlationId } = event.data;
    
    try {
      // Get the requested data
      const userDetails = await this.userRepository.findById(userId);
      
      // Send the response using the correlation ID
      await this.eventBus.emit(`user.details.response.${correlationId}`, userDetails);
    } catch (error) {
      // Handle errors
      await this.handleError(error, { userId, correlationId });
    }
  });
}
```

---

## 📦 Adding Submodules to Your Application

Since TSMIS Core is designed to be an independent npm package, here's how to add and organize submodules in your application:

### Directory Structure for Business Modules

```
your-application/
├── node_modules/
│   └── tsmis-core/        # TSMIS Core as npm dependency
├── src/
│   ├── app.js             # Main application file
│   ├── config/            # Configuration files
│   └── modules/           # Business modules
│       ├── user/          # User module
│       │   ├── UserModule.js
│       │   ├── repositories/
│       │   ├── services/
│       │   └── index.js
│       ├── order/         # Order module
│       │   ├── OrderModule.js
│       │   ├── repositories/
│       │   └── index.js
│       └── notification/  # Notification module
│           ├── NotificationModule.js
│           ├── templates/
│           └── index.js
└── package.json
```

### Creating a Module

```javascript
// src/modules/user/UserModule.js
import { CoreModule } from 'tsmis-core';
import { UserRepository } from './repositories/UserRepository.js';
import { UserService } from './services/UserService.js';

export class UserModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'database'];
  
  async onConfigure() {
    // Set up module-specific configuration
    this.userRepository = new UserRepository(this.deps.database);
    this.userService = new UserService(this.userRepository);
  }
  
  async setupEventHandlers() {
    const eventBus = this.deps.eventBusSystem.getEventBus();
    
    this.subscriptions = [
      eventBus.subscribe('auth.login', this.handleUserLogin.bind(this)),
      eventBus.subscribe('user.profile.updated', this.handleProfileUpdate.bind(this))
    ];
  }
  
  // Public API methods
  async createUser(userData) {
    try {
      const user = await this.userService.createUser(userData);
      await this.emit('user.created', user);
      return user;
    } catch (error) {
      await this.handleError(error, { userData });
      throw error;
    }
  }
  
  async getUserById(id) {
    return this.userRepository.findById(id);
  }
  
  // Event handlers
  async handleUserLogin(event) {
    await this.userService.updateLastLogin(event.data.userId);
  }
  
  async handleProfileUpdate(event) {
    // Handle profile updates
  }
}
```

### Module Export Pattern

```javascript
// src/modules/user/index.js
export { UserModule } from './UserModule.js';
```

### Registering Modules in Your Application

```javascript
// src/app.js
import { CoreContainer } from 'tsmis-core';
import { createErrorSystem, createEventBusSystem, createModuleSystem } from 'tsmis-core';
import { DatabaseService } from './services/DatabaseService.js';

// Import modules
import { UserModule } from './modules/user/index.js';
import { OrderModule } from './modules/order/index.js';
import { NotificationModule } from './modules/notification/index.js';

async function bootstrap() {
  // Create container
  const container = new CoreContainer();
  
  // Register core systems
  container.register('errorSystem', createErrorSystem);
  container.register('config', () => require('./config/app-config.js'));
  container.register('eventBusSystem', createEventBusSystem);
  container.register('moduleSystem', createModuleSystem);
  
  // Register services
  container.register('database', DatabaseService);
  
  // Initialize container
  await container.initialize();
  
  // Get module system
  const moduleSystem = await container.resolve('moduleSystem');
  
  // Register business modules with specific configurations
  await moduleSystem.register('userModule', UserModule, {
    userCache: { enabled: true, ttl: 3600000 }
  });
  
  await moduleSystem.register('orderModule', OrderModule, {
    orderProcessing: { batchSize: 50 }
  });
  
  await moduleSystem.register('notificationModule', NotificationModule, {
    email: { provider: 'sendgrid', apiKey: process.env.SENDGRID_API_KEY }
  });
  
  // Initialize all modules
  await moduleSystem.initialize();
  
  console.log('Application started successfully!');
  return container;
}

// Start the application
bootstrap().catch(console.error);
```

### Using Modules from Your Application Code

```javascript
// src/api/userController.js
export async function createUser(req, res, next) {
  try {
    // Get the module system
    const moduleSystem = req.app.get('moduleSystem');
    
    // Resolve the user module
    const userModule = await moduleSystem.resolve('userModule');
    
    // Use the module's functionality
    const user = await userModule.createUser(req.body);
    
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}
```

---

## 🧰 Key Features

- ✅ **Modular & Extensible**: Add or remove capabilities without affecting other parts
- ✅ **Full Event Lifecycle**: Comprehensive event handling (emit, queue, process, history)
- ✅ **Wildcard Event Forwarding**: Subscribe with patterns like `user.*`, `*.created`, or `*`
- ✅ **Pattern-Based Subscriptions**: Flexible event subscription patterns
- ✅ **Containerized Dependencies**: Automatic dependency resolution and management
- ✅ **100% Manual Test Coverage**: Comprehensive test suite with line and branch coverage
- ✅ **Developer-Friendly Debug Logs**: Clear, contextual logging for development
- ✅ **Safe for Production**: Environment-aware behaviors and optimizations
- ✅ **Fully Pluggable Architecture**: Compose your application with interchangeable modules

---

## 📥 Installation

```bash
npm install tsmis-core
```

---

## 🛠️ How to Use TSMIS Core in Your Project

TSMIS Core is designed as a collection of independent modules that you wire together in your application. Here's how you can integrate it:

### Bootstrapping Your Application

Create an entry point for your app (for example, app.js) where you set up the core container and register both built-in and your custom modules.

```js
// app.js
import { CoreContainer } from 'tsmis-core';
import {
  createErrorSystem,
  createEventBusSystem,
  createModuleSystem
} from 'tsmis-core';

(async () => {
  // Create a new dependency injection container
  const container = new CoreContainer();

  // Register the core systems
  container.register('errorSystem', createErrorSystem);
  container.register('eventBusSystem', createEventBusSystem);
  container.register('moduleSystem', createModuleSystem);
  container.register('config', () => ({
    // Your application configuration
    appName: 'MyTSMISApp',
    environment: process.env.NODE_ENV || 'development',
    // Module-specific configurations
    userModule: {
      userCache: { enabled: true, ttl: 3600000 }
    }
  }));

  // Optionally, register your own business modules
  // container.register('myModule', require('./modules/MyModule'));

  // Initialize the container (this sets up all the core systems)
  await container.initialize();

  // Resolve systems when needed:
  const eventBusSystem = await container.resolve('eventBusSystem');
  const eventBus = eventBusSystem.getEventBus();
  const moduleSystem = await container.resolve('moduleSystem');
  const errorSystem = await container.resolve('errorSystem');

  // Example: Emit an event using the event bus
  eventBus.on('user.created', (event) => {
    console.log('New user created:', event);
  });
  await eventBus.emit('user.created', { id: 1, name: 'Alice' });

  // Example: Resolve a custom module and use it
  // const myModule = await moduleSystem.resolve('myModule');
  // myModule.doSomething();

  console.log('TSMIS Core initialized and ready to use!');
})();
```

### Using the Core Systems

#### Dependency Injection & Module Resolution:

Register and resolve modules so that dependencies are automatically injected:

```js
// MyModule.js
import { CoreModule } from 'tsmis-core';

class MyModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'database'];
  
  constructor(deps) {
    super(deps);
    this.database = deps.database;
  }

  async onInitialize() {
    console.log('MyModule initialized');
  }

  async doSomething() {
    console.log('Doing something in MyModule');
    const result = await this.database.query('SELECT * FROM items');
    return result;
  }
}

export { MyModule };
```

Register and resolve the module:

```js
// In your app.js, after setting up the container:
import { MyModule } from './modules/MyModule.js';

container.register('database', DatabaseService);
container.register('myModule', MyModule);

const myModule = await container.resolve('myModule');
await myModule.doSomething();
```

#### Event-Driven Architecture:

Communicate between modules using the EventBusSystem:

```js
// Emitting an event:
const eventBus = eventBusSystem.getEventBus();
await eventBus.emit('user.created', { id: 1, name: 'Alice' });

// Subscribing to an event:
eventBus.subscribe('user.created', (event) => {
  console.log('User created event received:', event.data);
  
  // The event object includes:
  // - id: Unique identifier
  // - name: 'user.created'
  // - data: The payload ({ id: 1, name: 'Alice' })
  // - timestamp: When the event occurred
  // - metadata: Additional information
});

// Pattern-based subscriptions:
eventBus.subscribe('user.*', (event) => {
  console.log(`User event received: ${event.name}`);
});

// Wildcard subscription (all events):
eventBus.subscribe('*', (event) => {
  console.log(`Event received: ${event.name}`);
});
```

#### Error Handling:

Utilize the ErrorSystem for creating and handling errors with consistent types and detailed context:

```js
import { ValidationError } from 'tsmis-core';

try {
  // Input validation
  if (!email.includes('@')) {
    throw new ValidationError(
      'INVALID_EMAIL',
      'Email format is invalid',
      { email, field: 'email' }
    );
  }
  
  // Operation that may throw an error
  await createUser(userData);
} catch (err) {
  // Handle the error with context
  await errorSystem.handleError(err, { 
    operation: 'userRegistration',
    userData
  });
  
  // The error will be:
  // - Logged with proper context
  // - Tracked in the error system
  // - Formatted appropriately for the environment
}
```

---

## 📦 Folder Structure

```
src/
  core/
    container/        # Dependency injection container
    event/            # EventBus system
    error/            # Structured error handling
    module/           # Module and ModuleSystem logic
  app.js              # Application bootstrap
tests/
  core/
    container/        # Container tests
    event/            # EventBus tests
    error/            # Error system tests
    module/           # Module system tests
```

---

## 🧪 Testing & Coverage

TSMIS Core ships with full line and branch test coverage. To run tests:

```bash
npm test -- verbose --coverage
```

To generate coverage reports:

```bash
npx nyc --reporter=lcov --reporter=text npm test
```

You'll see detailed output like:

```
Module.js           | 100%   | 100%   | 95.83% | 100%
ModuleSystem.js     | 100%   | 100%   | 94.73% | 100%
```

### Writing Tests for Your Modules

```javascript
// tests/modules/UserModule.test.js
import { CoreModule } from 'tsmis-core';
import { UserModule } from '../../src/modules/user/UserModule.js';
import assert from 'assert';

describe('UserModule', () => {
  let userModule;
  let mockDatabase;
  let mockEventBus;
  let emittedEvents = [];
  
  beforeEach(async () => {
    // Reset tracking
    emittedEvents = [];
    
    // Create mock dependencies with plain JavaScript
    mockDatabase = {
      users: {
        create: (userData) => {
          return Promise.resolve({ id: 'user-123', name: 'Test User' });
        }
      }
    };
    
    // Track called methods
    const createSpy = mockDatabase.users.create;
    mockDatabase.users.create = (userData) => {
      mockDatabase.users.create.calls = mockDatabase.users.create.calls || [];
      mockDatabase.users.create.calls.push({ args: [userData] });
      return createSpy(userData);
    };
    
    mockEventBus = {
      subscribe: (event, handler) => {
        return 'sub-id';
      },
      emit: (eventName, data) => {
        emittedEvents.push({ eventName, data });
        return Promise.resolve(true);
      },
      unsubscribe: () => {}
    };
    
    const mockEventBusSystem = {
      getEventBus: () => mockEventBus
    };
    
    const mockErrorSystem = {
      handleError: () => Promise.resolve()
    };
    
    // Create module with dependencies
    userModule = new UserModule({
      database: mockDatabase,
      eventBusSystem: mockEventBusSystem,
      errorSystem: mockErrorSystem,
      config: {}
    });
    
    // Initialize
    await userModule.initialize();
  });
  
  test('should create a user', async () => {
    const userData = { name: 'Test User', email: 'test@example.com' };
    const result = await userModule.createUser(userData);
    
    // Verify database was called with correct data
    assert.strictEqual(mockDatabase.users.create.calls.length, 1);
    assert.deepStrictEqual(mockDatabase.users.create.calls[0].args[0], userData);
    
    // Verify event was emitted
    assert.strictEqual(emittedEvents.length, 1);
    assert.strictEqual(emittedEvents[0].eventName, 'user.created');
    assert.deepStrictEqual(emittedEvents[0].data, { 
      id: 'user-123', 
      name: 'Test User' 
    });
    
    // Verify result
    assert.deepStrictEqual(result, { id: 'user-123', name: 'Test User' });
  });
});
```

---

## 🧠 Why TSMIS?

There are many backend frameworks, but few that combine:

- **Event-first design**: Built around events rather than routes or controllers
- **DI + modularity**: True separation of concerns with automatic dependency management
- **Full health observability**: Comprehensive health monitoring at all levels
- **Wildcard and pattern event support**: Flexible event subscription patterns
- **Test-first development**: Designed with testability as a primary concern
- **Comprehensive error handling**: Structured, contextual error management

TSMIS isn't just another framework — it's a **core runtime** designed to run a suite of interdependent business systems that can evolve independently while maintaining clear interfaces.

---

## 📈 Ideal Use Cases

- **Enterprise internal platforms**: Build scalable, maintainable internal tools
- **Modular monoliths**: Create well-structured monolithic applications
- **Backend service infrastructure**: Build reliable, observable services
- **Low-code/high-productivity platforms**: Create platforms for rapid application development
- **Scalable distributed tools**: Build foundations for distributed systems
- **Multi-team projects**: Enable multiple teams to work independently on different modules

---

## 🧩 Integrations

TSMIS Core is designed to plug into any stack, but plays especially well with:

- **Fastify** for HTTP APIs
- **GraphQL** for flexible APIs
- **PostgreSQL/MySQL** for relational data
- **MongoDB** for document databases
- **Redis** for caching and pub/sub
- **NATS/RabbitMQ** for advanced messaging
- **Prometheus** for metrics
- **OpenTelemetry** for tracing

---

## 🛠️ Development Notes

- Debug logs can be toggled using `process.env.DEBUG=true`
- Stack traces are cleaned in production
- Sensitive data is excluded from public stack traces
- Set `NODE_ENV=development` for enhanced developer experience
- Set `NODE_ENV=production` for optimized performance

---

## 👥 Contributing

We welcome contributions to TSMIS Core! Here's how you can help:

### How to Contribute

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes**: Implement your feature or fix
4. **Add tests**: Maintain 100% test coverage
5. **Run tests**: `npm test`
6. **Update documentation**: Keep docs in sync with code
7. **Submit a pull request**: Include a clear description of changes

### Contribution Guidelines

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add or update tests for all changes
- Update documentation for API changes
- Maintain backward compatibility
- Open an issue for major changes

### Code of Conduct

- Be respectful and inclusive
- Value constructive feedback
- Support a collaborative environment

---

## 📊 Versioning

TSMIS Core follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality
- **PATCH** version for backward-compatible bug fixes

### Version Compatibility

- We maintain compatibility within major versions
- Breaking changes are documented in release notes
- Deprecation notices are provided before removal
- LTS (Long Term Support) versions are maintained for enterprise users

---

## 📄 License

MIT License. See [LICENSE](./LICENSE).

---

## 🐂 About the Name

**TSMIS** = **Toro-SM System Management Information Stack** — the strong, test-first foundation for building anything your business needs.

---

## 💬 Contact

Built and maintained with care by [Your Name / Your Org].

Questions? Ideas? Start a discussion!

---

## 📚 Additional Resources

- [Architectural Decision Records](./docs/adr)
- [API Documentation](./docs/api)
- [Migration Guides](./docs/migrations)
- [Examples](./examples)
- [Performance Tips](./docs/performance)

---