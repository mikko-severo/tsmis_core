/**
 * TESTS
 *
 * The tests are organized into the following sections:
 * - Named Exports: Tests for all named exports from the module.
 * - Default Export: Tests for the default export object structure.
 * - Export Integrity: Tests to ensure all components are properly exported.
 */

// Import components from index.js
import RouterIndex, {
    CoreRouter,
    RouterSystem,
    createRouterSystem,
    RoutableModule,
    createRoutableModule,
    IRouterAdapter,
    FastifyAdapter,
    ExpressAdapter
  } from '../../../src/core/router/index.js';
  
  
  describe('Router Index Exports', () => {
    // --------------------------------------------------
    // - Named Exports
    // --------------------------------------------------
    describe('Named Exports', () => {
      test('should export CoreRouter class', () => {
        expect(CoreRouter).toBeDefined();
        expect(typeof CoreRouter).toEqual('function');
        expect(CoreRouter.name).toEqual('CoreRouter');
      });
  
      test('should export RouterSystem class', () => {
        expect(RouterSystem).toBeDefined();
        expect(typeof RouterSystem).toEqual('function');
        expect(RouterSystem.name).toEqual('RouterSystem');
      });
  
      test('should export createRouterSystem factory function', () => {
        expect(createRouterSystem).toBeDefined();
        expect(typeof createRouterSystem).toEqual('function');
      });
  
      test('should export RoutableModule class', () => {
        expect(RoutableModule).toBeDefined();
        expect(typeof RoutableModule).toEqual('function');
        expect(RoutableModule.name).toEqual('RoutableModule');
      });
  
      test('should export createRoutableModule factory function', () => {
        expect(createRoutableModule).toBeDefined();
        expect(typeof createRoutableModule).toEqual('function');
      });
  
      test('should export IRouterAdapter interface', () => {
        expect(IRouterAdapter).toBeDefined();
        expect(typeof IRouterAdapter).toEqual('function');
        expect(IRouterAdapter.name).toEqual('IRouterAdapter');
      });
  
      test('should export FastifyAdapter class', () => {
        expect(FastifyAdapter).toBeDefined();
        expect(typeof FastifyAdapter).toEqual('function');
        expect(FastifyAdapter.name).toEqual('FastifyAdapter');
      });
  
      test('should export ExpressAdapter class', () => {
        expect(ExpressAdapter).toBeDefined();
        expect(typeof ExpressAdapter).toEqual('function');
        expect(ExpressAdapter.name).toEqual('ExpressAdapter');
      });
    });
  
    // --------------------------------------------------
    // - Default Export
    // --------------------------------------------------
    describe('Default Export', () => {
      test('should have CoreRouter in default export', () => {
        expect(RouterIndex.CoreRouter).toBeDefined();
        expect(RouterIndex.CoreRouter).toEqual(CoreRouter);
      });
  
      test('should have RouterSystem in default export', () => {
        expect(RouterIndex.RouterSystem).toBeDefined();
        expect(RouterIndex.RouterSystem).toEqual(RouterSystem);
      });
  
      test('should have createRouterSystem in default export', () => {
        expect(RouterIndex.createRouterSystem).toBeDefined();
        expect(RouterIndex.createRouterSystem).toEqual(createRouterSystem);
      });
  
      test('should have RoutableModule in default export', () => {
        expect(RouterIndex.RoutableModule).toBeDefined();
        expect(RouterIndex.RoutableModule).toEqual(RoutableModule);
      });
  
      test('should have createRoutableModule in default export', () => {
        expect(RouterIndex.createRoutableModule).toBeDefined();
        expect(RouterIndex.createRoutableModule).toEqual(createRoutableModule);
      });
  
      test('should have integrations object in default export', () => {
        expect(RouterIndex.integrations).toBeDefined();
        expect(typeof RouterIndex.integrations).toEqual('object');
      });
  
      test('should have IRouterAdapter in integrations object', () => {
        expect(RouterIndex.integrations.IRouterAdapter).toBeDefined();
        expect(RouterIndex.integrations.IRouterAdapter).toEqual(IRouterAdapter);
      });
  
      test('should have FastifyAdapter in integrations object', () => {
        expect(RouterIndex.integrations.FastifyAdapter).toBeDefined();
        expect(RouterIndex.integrations.FastifyAdapter).toEqual(FastifyAdapter);
      });
  
      test('should have ExpressAdapter in integrations object', () => {
        expect(RouterIndex.integrations.ExpressAdapter).toBeDefined();
        expect(RouterIndex.integrations.ExpressAdapter).toEqual(ExpressAdapter);
      });
    });
  
    // --------------------------------------------------
    // - Export Integrity
    // --------------------------------------------------
    describe('Export Integrity', () => {
      test('should maintain class integrity in exports', () => {
        // Create simple mock dependencies required by RouterSystem
        const mockDeps = {
          errorSystem: { handleError: () => {} },
          eventBusSystem: { getEventBus: () => ({}) },
          config: {}
        };
        
        const system = new RouterSystem(mockDeps);
        expect(system instanceof RouterSystem).toEqual(true);
      });
  
    //   test('should ensure factory functions return correct instances', () => {
    //     // Create simple mock dependencies required by RouterSystem
    //     const mockDeps = {
    //       errorSystem: { handleError: () => {} },
    //       eventBusSystem: { getEventBus: () => ({}) },
    //       config: {}
    //     };
        
    //     const routerSystem = createRouterSystem(mockDeps);
    //     const routableModule = createRoutableModule();
  
    //     expect(routerSystem instanceof RouterSystem).toEqual(true);
    //     expect(routableModule instanceof RoutableModule).toEqual(true);
    //   });
  
      test('should ensure adapter inheritance is preserved', () => {
        const fastifyAdapter = new FastifyAdapter();
        const expressAdapter = new ExpressAdapter();
  
        expect(fastifyAdapter instanceof IRouterAdapter).toEqual(true);
        expect(expressAdapter instanceof IRouterAdapter).toEqual(true);
      });
    });
  });