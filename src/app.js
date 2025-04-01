// src/app.js

import 'dotenv/config';
import Fastify from 'fastify';

// Core System Imports
import { CoreContainer } from './core/container/Container.js';
import { createErrorSystem } from './core/errors/ErrorSystem.js';
import { setupErrorHandler } from './core/errors/integrations/fastify/handler.js';
import { createModuleSystem } from './core/module/ModuleSystem.js';
import { createEventBusSystem } from './core/event/EventBusSystem.js';

export async function buildApp() {
  // Create the core container
  const container = new CoreContainer();

  // Register core systems in proper order
  container.register('errorSystem', createErrorSystem);
  container.register('config', () => ({}));
  container.register('eventBusSystem', createEventBusSystem);
  container.register('moduleSystem', createModuleSystem);

  // Create Fastify instance with error serialization
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        error: (error) => {
          const errorSystem = container.resolve('errorSystem');
          return errorSystem.serializeError(error);
        }
      }
    }
  });

  // Setup Fastify error handling - THIS LINE IS PRESENT
  setupErrorHandler(fastify);

  // Initialize the container
  try {
    await container.initialize();
  } catch (error) {
    console.error('Container initialization error:', error);
    throw error;
  }

  // Basic route as a health check
  fastify.get('/', async (request, reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    };
  });

  // Graceful shutdown handling
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
  fastify.addHook('onClose', async () => {
    await container.shutdown();
  });

  return fastify;
}