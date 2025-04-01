# Test Suite Instructions

## Core Testing Principles

1. **Use Real Core System Implementations**
   - Always use real implementations of ErrorSystem, EventBusSystem, ModuleSystem, etc.
   - These core systems are designed to work together and should be tested together
   - Use the actual `createErrorSystem()`, `createEventBusSystem()`, etc, factory functions
   - Only mock external dependencies like databases, APIs, or file systems
   - Example:
     ```javascript
     // Instead of mocking core systems:
     const container = new CoreContainer();
     container.register('errorSystem', createErrorSystem);
     container.register('config', () => testConfig);
     container.register('eventBusSystem', createEventBusSystem);
     container.register('moduleSystem', createModuleSystem);
     
     // Then resolve the system under test
     const moduleSystem = await container.resolve('moduleSystem');
     ```

2. **Use Domain-Specific Error Types**
   - Use the appropriate specialized error types (EventError, ModuleError, etc.)
   - Let errors flow through the actual ErrorSystem for realistic testing
   - Test that errors are properly handled, logged, and propagated
   - Example:
     ```javascript
     // In the system being tested
     if (!this.initialized) {
       throw new ModuleError(
         ErrorCodes.MODULE.NOT_INITIALIZED,
         'Module must be initialized before use',
         { moduleName: this.constructor.name }
       );
     }
     
     // In the test
     try {
       await moduleUnderTest.performOperation();
       expect('Should have thrown').toEqual(false);
     } catch (error) {
       expect(error instanceof ModuleError).toEqual(true);
       expect(error.code).toEqual('MODULE_NOT_INITIALIZED');
       
       // Check error was handled by the error system
       const errorSystem = await container.resolve('errorSystem');
       const errors = errorSystem.getRecentErrors();
       expect(errors.length).toBeGreaterThan(0);
       expect(errors[0].code).toEqual('MODULE_NOT_INITIALIZED');
     }
     ```

3. **Structured Test Organization**
   - Group tests logically by functionality using nested describe blocks
   - Use clear, descriptive test names that explain the expected behavior
   - Follow the pattern: `describe('Component', () => { describe('Method/Scenario', () => { test('should behave this way when...') }); });`
   - Example:
     ```javascript
     describe('EventBusSystem', () => {
       describe('initialization', () => {
         test('should initialize successfully with valid dependencies', () => {});
         test('should throw when missing dependencies', () => {});
       });
       
       describe('event forwarding', () => {
         test('should forward events from eventBus to system level', () => {});
       });
     });
     ```

4. **Track Events and Errors**
   - Use event listeners to capture emitted events instead of mocking
   - Subscribe to the error and event systems to track activity
   - Create tracking arrays to collect events and errors during tests
   - Example:
     ```javascript
     // Setup event tracking
     const capturedEvents = [];
     const eventBusSystem = await container.resolve('eventBusSystem');
     const eventBus = eventBusSystem.getEventBus();
     
     // Listen for all events with wildcard
     const wildcardSubscriptionId = eventBus.subscribe('*', (event) => {
       capturedEvents.push(event);
     });
     
     // Run test
     await moduleUnderTest.performOperation();
     
     // Verify events
     expect(capturedEvents.length).toEqual(1);
     expect(capturedEvents[0].name).toEqual('user.created');
     expect(capturedEvents[0].data.id).toBeDefined();
     
     // Clean up
     eventBus.unsubscribe(wildcardSubscriptionId);
     ```

5. **Comprehensive Test Coverage**
   - Test the "happy path" for all public methods
   - Test edge cases and boundary conditions
   - Test error handling for all expected failure modes
   - Test system integration, especially between core systems
   - Test asynchronous behavior, including timeouts and race conditions
   - Verify event emissions and subscriptions
   - Test full lifecycle from initialization to shutdown
   - Use coverage reports to identify untested code paths

6. **Proper Setup and Teardown**
   - Use beforeEach for setting up the container and common dependencies
   - Use afterEach to properly shut down and clean up resources
   - Initialize systems for each test or in beforeEach
   - Properly clean up subscriptions and listeners after tests
   - Example:
     ```javascript
     let container;
     let moduleSystem;
     let eventBusSystem;
     let capturedEvents;
     let eventSubscriptionId;
     
     beforeEach(async () => {
       // Create container with real implementations
       container = new CoreContainer();
       container.register('errorSystem', createErrorSystem);
       container.register('config', () => testConfig);
       container.register('eventBusSystem', createEventBusSystem);
       container.register('moduleSystem', createModuleSystem);
       
       // Initialize container
       await container.initialize();
       
       // Resolve systems
       moduleSystem = await container.resolve('moduleSystem');
       eventBusSystem = await container.resolve('eventBusSystem');
       const eventBus = eventBusSystem.getEventBus();
       
       // Setup event tracking
       capturedEvents = [];
       eventSubscriptionId = eventBus.subscribe('*', (event) => {
         capturedEvents.push(event);
       });
     });
     
     afterEach(async () => {
       // Clean up event subscription
       if (eventBusSystem?.initialized) {
         const eventBus = eventBusSystem.getEventBus();
         eventBus.unsubscribe(eventSubscriptionId);
       }
       
       // Shutdown container
       if (container) {
         await container.shutdown();
       }
     });
     ```

7. **Effective Assertions**
   - Make specific assertions that verify the exact expected behavior
   - Check state changes in the systems under test
   - Verify events were properly emitted and handled
   - For errors, assert they propagate through the error system
   - Example:
     ```javascript
     test('should emit module:initialized event on initialization', async () => {
       // Act
       await moduleSystem.register('testModule', TestModule);
       await moduleSystem.initialize();
       
       // Assert
       const moduleInitEvents = capturedEvents.filter(
         e => e.name === 'module:initialized'
       );
       expect(moduleInitEvents.length).toEqual(1);
       expect(moduleInitEvents[0].data.name).toEqual('testModule');
       
       // Check module is properly initialized
       const testModule = await moduleSystem.resolve('testModule');
       expect(testModule.initialized).toEqual(true);
       expect(testModule.state.status).toEqual('running');
     });
     ```

8. **Testing Error Handling Paths**
   - Create scenarios that trigger realistic errors
   - Verify errors flow through the actual ErrorSystem
   - Check appropriate error events are emitted
   - Verify system state after errors
   - Example:
     ```javascript
     test('should handle initialization errors', async () => {
       // Arrange - create module with initialization error
       class BrokenModule extends CoreModule {
         async onInitialize() {
           throw new ModuleError('INIT_FAILED', 'Initialization failed');
         }
       }
       
       await moduleSystem.register('brokenModule', BrokenModule);
       
       try {
         // Act
         await moduleSystem.initialize();
         expect('Should have thrown').toEqual(false);
       } catch (error) {
         // Assert
         expect(error instanceof ModuleError).toEqual(true);
         
         // Check error was handled by the error system
         const errorSystem = await container.resolve('errorSystem');
         const errors = errorSystem.getRecentErrors();
         expect(errors.some(e => e.code === 'INIT_FAILED')).toEqual(true);
         
         // Check appropriate error event was emitted
         const errorEvents = capturedEvents.filter(e => e.name === 'module:error');
         expect(errorEvents.length).toBeGreaterThan(0);
         expect(errorEvents[0].data.module).toEqual('brokenModule');
       }
     });
     ```

9. **Test Lifecycle and State Management**
   - Test the full component lifecycle (init → operate → shutdown)
   - Verify proper state transitions during lifecycle methods
   - Test that resources are properly cleaned up during shutdown
   - Verify container manages dependencies correctly
   - Example:
     ```javascript
     test('should properly clean up resources during shutdown', async () => {
       // Arrange
       await moduleSystem.register('testModule', TestModule);
       await moduleSystem.initialize();
       const testModule = await moduleSystem.resolve('testModule');
       
       // Create a tracking variable to verify shutdown
       let moduleShutdownCalled = false;
       const originalShutdown = testModule.onShutdown;
       testModule.onShutdown = async function() {
         moduleShutdownCalled = true;
         return await originalShutdown.call(this);
       };
       
       try {
         // Act
         await container.shutdown();
         
         // Assert
         expect(moduleShutdownCalled).toEqual(true);
         expect(testModule.state.status).toEqual('shutdown');
         expect(moduleSystem.initialized).toEqual(false);
         
         // Verify shutdown events were emitted
         const shutdownEvents = capturedEvents.filter(
           e => e.name === 'module:shutdown' || e.name === 'system:shutdown'
         );
         expect(shutdownEvents.length).toBeGreaterThan(1);
       } finally {
         // Cleanup - restore original method
         if (testModule) {
           testModule.onShutdown = originalShutdown;
         }
       }
     });
     ```

10. **Clear Test Documentation**
    - Include a structured comment block describing the test organization
    - Write descriptive test names that serve as documentation
    - Document complex test setup or non-obvious assertions
    - Example:
    ```javascript
    /**
     * TESTS
     *
     * The tests are organized into the following sections:
     * - Initialization: Tests for proper setup and initialization
     * - Dependency Resolution: Tests for container dependency resolution
     * - Module Registration: Tests for module registration/resolution
     * - Health Monitoring: Tests for health checking and metrics
     * - Error Handling: Tests for error handling and propagation
     * - Lifecycle Management: Tests for shutdown and cleanup
     * - Event Integration: Tests for event handling and forwarding
     */
    ```

## Example Test Suite Structure

```javascript
/**
 * TESTS
 *
 * The tests are organized into the following sections:
 * - Container Setup: Tests for container initialization
 * - System Integration: Tests for core system integration
 * - Module Management: Tests for module registration and lifecycle
 * - Event Communication: Tests for event handling and propagation
 * - Error Handling: Tests for error propagation through systems
 * - Health Monitoring: Tests for health status across systems
 */

describe('Core Systems Integration', () => {
  let container;
  let errorSystem;
  let eventBusSystem;
  let moduleSystem;
  let capturedEvents = [];
  let eventSubscriptionId;
  
  beforeEach(async () => {
    // Reset tracking
    capturedEvents = [];
    
    // Create container with real implementations
    container = new CoreContainer();
    container.register('errorSystem', createErrorSystem);
    container.register('config', () => ({
      eventHistory: { maxSize: 10 }
    }));
    container.register('eventBusSystem', createEventBusSystem);
    container.register('moduleSystem', createModuleSystem);
    
    // Initialize container
    await container.initialize();
    
    // Resolve systems
    errorSystem = await container.resolve('errorSystem');
    eventBusSystem = await container.resolve('eventBusSystem');
    moduleSystem = await container.resolve('moduleSystem');
    
    // Setup event tracking
    const eventBus = eventBusSystem.getEventBus();
    eventSubscriptionId = eventBus.subscribe('*', (event) => {
      capturedEvents.push(event);
    });
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
  
  // CONTAINER SETUP
  describe('Container Setup', () => {
    test('should initialize all core systems', () => {
      expect(errorSystem.initialized).toEqual(true);
      expect(eventBusSystem.initialized).toEqual(true);
      expect(moduleSystem.initialized).toEqual(true);
    });
    
    test('should establish proper dependencies between systems', () => {
      // EventBusSystem should have ErrorSystem as dependency
      expect(eventBusSystem.deps.errorSystem).toBe(errorSystem);
      
      // ModuleSystem should have both dependencies
      expect(moduleSystem.deps.errorSystem).toBe(errorSystem);
      expect(moduleSystem.deps.eventBusSystem).toBe(eventBusSystem);
    });
  });
  
  // SYSTEM INTEGRATION
  describe('System Integration', () => {
    test('should propagate errors through error system', async () => {
      // Create a test error
      const testError = new ModuleError(
        'TEST_ERROR',
        'Test error message',
        { source: 'test' }
      );
      
      // Process through error system
      await errorSystem.handleError(testError, { test: 'context' });
      
      // Verify error was handled and events were emitted
      const errorEvents = capturedEvents.filter(e => e.name === 'error:handled');
      expect(errorEvents.length).toEqual(1);
      expect(errorEvents[0].data.error.code).toEqual('MODULE_TEST_ERROR');
      expect(errorEvents[0].data.context.test).toEqual('context');
    });
    
    test('should forward events between modules through event system', async () => {
      // Define test modules with event communication
      class SenderModule extends CoreModule {
        async sendMessage(message) {
          await this.emit('message.sent', { content: message });
        }
      }
      
      class ReceiverModule extends CoreModule {
        constructor(deps) {
          super(deps);
          this.receivedMessages = [];
        }
        
        async setupEventHandlers() {
          const eventBus = this.deps.eventBusSystem.getEventBus();
          this.subscriptions = [
            eventBus.subscribe('message.sent', this.handleMessage.bind(this))
          ];
        }
        
        async handleMessage(event) {
          this.receivedMessages.push(event.data.content);
        }
      }
      
      // Register and initialize modules
      await moduleSystem.register('sender', SenderModule);
      await moduleSystem.register('receiver', ReceiverModule);
      await moduleSystem.initialize();
      
      // Resolve modules
      const sender = await moduleSystem.resolve('sender');
      const receiver = await moduleSystem.resolve('receiver');
      
      // Send a message
      await sender.sendMessage('Hello World');
      
      // Verify message was received
      expect(receiver.receivedMessages.length).toEqual(1);
      expect(receiver.receivedMessages[0]).toEqual('Hello World');
      
      // Verify event was captured
      const messageEvents = capturedEvents.filter(e => e.name === 'message.sent');
      expect(messageEvents.length).toEqual(1);
      expect(messageEvents[0].data.content).toEqual('Hello World');
    });
  });
  
  // Additional test groups...
});
```