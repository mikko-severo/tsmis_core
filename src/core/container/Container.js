// src/core/container/Container.js

import { EventEmitter } from 'events';
import { CoreError, ConfigError, ServiceError } from '../errors/index.js';
// import { ValidationService } from '../validation/ValidationService.js';

export class CoreContainer extends EventEmitter {
  constructor() {
    super();
    this.components = new Map();
    this.instances = new Map();
    this.dependencies = new Map();
    this.manifests = new Map();
    this.initialized = false;
  }

  /**
   * Register a component manifest
   * @param {string} type - Component type
   * @param {object} manifest - Component manifest
   */
  registerManifest(type, manifest) {
    if (this.manifests.has(type)) {
      throw new ConfigError(
        'DUPLICATE_MANIFEST',
        `Manifest already registered for type: ${type}`
      );
    }
    this.manifests.set(type, manifest);
    this.emit('manifest:registered', { type, manifest });
  }

  /**
   * Register a component with the container
   * @param {string} name - Component name
   * @param {Class} Component - Component constructor
   * @param {object} options - Registration options
   */
  register(name, Component, options = {}) {
    if (this.components.has(name)) {
      throw new ConfigError(
        'DUPLICATE_COMPONENT',
        `Component ${name} is already registered`
      );
    }

    // Store component definition
    this.components.set(name, {
      Component,
      options: {
        singleton: true,
        ...options
      }
    });

    // Store dependencies
    this.dependencies.set(name, Component.dependencies || []);

    this.emit('component:registered', { name, Component });
    return this;
  }

  /**
   * Discover components in a directory
   * @param {string} type - Component type
   * @param {string} basePath - Base directory path
   */
  async discover(type, basePath) {
    if (!this.manifests.has(type)) {
      throw new ConfigError(
        'INVALID_TYPE',
        `No manifest registered for type: ${type}`
      );
    }

    try {
      const manifest = this.manifests.get(type);
      const componentPaths = await this.scanDirectory(basePath);
      const discoveredComponents = new Map();

      for (const path of componentPaths) {
        try {
          const component = await this.loadComponent(path, manifest);
          if (component) {
            discoveredComponents.set(component.name, component);
          }
        } catch (error) {
          this.emit('discovery:error', { path, error });
        }
      }

      this.emit('discovery:completed', { type, components: discoveredComponents });
      return discoveredComponents;
    } catch (error) {
      throw new ServiceError(
        'DISCOVERY_FAILED',
        `Failed to discover ${type} components`,
        { originalError: error }
      );
    }
  }

  /**
   * Load a component from a path
   * @private
   */
  async loadComponent(path, manifest) {
    try {
      const config = await this.loadConfig(path);
      if (config.enabled === false) return null;

      await this.validateConfig(config, manifest.configSchema);
      const implementation = await this.loadImplementation(path);

      return {
        name: config.name,
        config,
        implementation
      };
    } catch (error) {
      throw new ConfigError(
        'LOAD_FAILED',
        `Failed to load component from ${path}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get an instance of a component
   * @param {string} name - Component name
   */
  async resolve(name) {
    if (!this.components.has(name)) {
      throw new ServiceError(
        'UNKNOWN_COMPONENT',
        `Component ${name} is not registered`
      );
    }
  
    const { Component, options } = this.components.get(name);
  
    // Return existing instance for singletons
    if (options.singleton && this.instances.has(name)) {
      return this.instances.get(name);
    }
  
    // Resolve dependencies first
    const deps = this.dependencies.get(name) || [];
    const resolvedDeps = {};
  
    for (const dep of deps) {
      resolvedDeps[dep] = await this.resolve(dep);
    }
  
    // Handle different component types
    let instance;
    if (typeof Component === 'function') {
      if (Component.prototype) {
        // Class constructor
        instance = new Component(resolvedDeps);
      } else {
        // Factory function - handle both sync and async
        instance = await Promise.resolve(Component(resolvedDeps));
      }
    } else {
      instance = Component;
    }
  
    // Initialize if container is initialized
    if (this.initialized && typeof instance.initialize === 'function') {
      await instance.initialize();
    }
  
    // Cache singleton instance
    if (options.singleton) {
      this.instances.set(name, instance);
    }
  
    this.emit('component:resolved', { name, instance });
    return instance;
  }
  /**
   * Initialize all registered components
   */
  async initialize() {
    if (this.initialized) {
      throw new ServiceError(
        'ALREADY_INITIALIZED',
        'Container is already initialized'
      );
    }
    //console.log('Initializing Container...');
    const order = this.resolveDependencyOrder();

    for (const name of order) {
      //console.log(`Resolving component: ${name}`);
      const instance = await this.resolve(name);
      if (typeof instance.initialize === 'function') {
        //console.log(`Initializing component: ${name}`);
        await instance.initialize();
      }
    }

    this.initialized = true;
    this.emit('initialized');

    
  }

  /**
   * Resolve dependency order for initialization
   * @private
   */
  resolveDependencyOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new ConfigError(
          'CIRCULAR_DEPENDENCY',
          `Circular dependency detected: ${name}`
        );
      }

      visiting.add(name);
      
      const component = this.components.get(name);
      const deps = this.dependencies.get(name) || [];
      
      for (const dep of deps) {
        if (!this.components.has(dep)) {
          throw new ConfigError(
            'MISSING_DEPENDENCY',
            `Dependency ${dep} required by ${name} is not registered`
          );
        }
        visit(dep);
      }
      
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    // Ensure core systems are initialized first
    const initOrder = [
      'errorSystem',
      'config',
      'eventBusSystem',
      'moduleSystem'
    ];

    for (const name of initOrder) {
      if (this.components.has(name)) {
        visit(name);
      }
    }

    // Then handle any remaining components
    for (const name of this.components.keys()) {
      if (!order.includes(name)) {
        visit(name);
      }
    }

    return order;
  }

async shutdown() {
    // Shutdown in reverse dependency order
    const order = this.resolveDependencyOrder().reverse();
  
    for (const name of order) {
      const instance = this.instances.get(name);
      if (instance && typeof instance.shutdown === 'function') {
        try {
          await instance.shutdown();
        } catch (error) {
          // Log error but continue shutdown process
          this.emit('shutdown:error', { 
            component: name, 
            error 
          });
        }
      }
    }
  
    this.instances.clear();
    this.initialized = false;
    this.emit('shutdown');
  }
}