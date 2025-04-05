// src/core/router/index.js
import { CoreRouter } from './Router.js';
import { RouterSystem, createRouterSystem } from './RouterSystem.js';
import { RoutableModule, createRoutableModule } from './RoutableModule.js';
import { 
  IRouterAdapter,
  FastifyAdapter,
  ExpressAdapter
} from './integrations/index.js';

// Export all components
export {
  // Core classes
  CoreRouter,
  RouterSystem,
  createRouterSystem,
  
  // Module extension
  RoutableModule,
  createRoutableModule,
  
  // Adapters
  IRouterAdapter,
  FastifyAdapter,
  ExpressAdapter
};

// Default export
export default {
  CoreRouter,
  RouterSystem,
  createRouterSystem,
  
  RoutableModule,
  createRoutableModule,
  
  integrations: {
    IRouterAdapter,
    FastifyAdapter,
    ExpressAdapter
  }
};