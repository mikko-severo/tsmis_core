// tests/core/errors/integrations/IFrameworkIntegration.test.js

import { IFrameworkIntegration } from '../../../../src/core/errors/integrations/IFrameworkIntegration.js';
import { CoreError } from '../../../../src/core/errors/Error.js';

// Mock framework for testing
class MockFramework {
  constructor() {
    this.errorHandler = null;
  }

  setErrorHandler(handler) {
    this.errorHandler = handler;
  }

  triggerError(error) {
    return this.errorHandler?.(error);
  }
}

describe('IFrameworkIntegration', () => {
  describe('Base Interface', () => {
    it('should throw errors for unimplemented methods', () => {
      const integration = new IFrameworkIntegration();

      expect(() => integration.initialize()).toThrow('initialize() must be implemented');
      expect(() => integration.serializeError()).toThrow('serializeError() must be implemented');
      expect(() => integration.mapError()).toThrow('mapError() must be implemented');
    });
  });

  describe('Framework Integration', () => {
    // Create a test implementation
    class TestIntegration extends IFrameworkIntegration {
      initialize(framework, options = {}) {
        this.framework = framework;
        this.options = options;
      }

      serializeError(error) {
        return {
          code: error.code || 'UNKNOWN',
          message: error.message,
          timestamp: new Date().toISOString()
        };
      }

      mapError(frameworkError) {
        if (frameworkError instanceof CoreError) {
          return frameworkError;
        }
        return new CoreError('TEST_ERROR', frameworkError.message);
      }
    }

    let integration;
    let mockFramework;

    beforeEach(() => {
      integration = new TestIntegration();
      mockFramework = new MockFramework();
    });

    it('should initialize with framework instance', () => {
      const options = { custom: 'option' };
      integration.initialize(mockFramework, options);

      expect(integration.framework).toBe(mockFramework);
      expect(integration.options).toEqual(options);
    });

    it('should serialize errors correctly', () => {
      const error = new Error('Test error');
      const serialized = integration.serializeError(error);

      expect(serialized).toHaveProperty('code', 'UNKNOWN');
      expect(serialized).toHaveProperty('message', 'Test error');
      expect(serialized).toHaveProperty('timestamp');
    });

    it('should map framework errors to CoreError', () => {
      const frameworkError = new Error('Framework error');
      const mappedError = integration.mapError(frameworkError);

      expect(mappedError).toBeInstanceOf(CoreError);
      expect(mappedError.code).toBe('TEST_ERROR');
      expect(mappedError.message).toBe('Framework error');
    });

    it('should pass through CoreError instances without mapping', () => {
      const coreError = new CoreError('ORIGINAL', 'Original error');
      const mappedError = integration.mapError(coreError);

      expect(mappedError).toBe(coreError);
    });

    it('should handle full error workflow', () => {
      const frameworkError = new Error('Framework test error');
      
      integration.initialize(mockFramework);
      
      const mappedError = integration.mapError(frameworkError);
      expect(mappedError).toBeInstanceOf(CoreError);
      
      const serialized = integration.serializeError(mappedError);
      expect(serialized).toEqual({
        code: 'TEST_ERROR',
        message: 'Framework test error',
        timestamp: expect.any(String)
      });
    });
  });
});