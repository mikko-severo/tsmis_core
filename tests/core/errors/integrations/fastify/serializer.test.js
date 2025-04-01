// tests/core/errors/integrations/fastify/serializer.test.js

import { errorSerializer } from '../../../../../src/core/errors/integrations/fastify/serializer.js';
import { CoreError, ErrorCodes } from '../../../../../src/core/errors/index.js';
import { ValidationError } from '../../../../../src/core/errors/types/ValidationError.js';

describe('Fastify Error Serializer', () => {
  it('should serialize CoreError correctly', () => {
    const error = new CoreError('TEST_ERROR', 'Test message', { detail: 'test' });
    const serialized = errorSerializer.serializer(error);

    expect(serialized).toMatchObject({
      code: 'TEST_ERROR',
      message: 'Test message',
      details: { detail: 'test' },
      timestamp: expect.any(String),
      context: {}
    });
  });

  it('should serialize ValidationError with validationErrors', () => {
    const error = new ValidationError(
      ErrorCodes.VALIDATION.FAILED,
      'Validation failed',
      {
        validationErrors: [{ field: 'test', message: 'required' }]
      }
    );
    const serialized = errorSerializer.serializer(error);

    expect(serialized).toMatchObject({
      code: `VALIDATION_${ErrorCodes.VALIDATION.FAILED}`,
      message: 'Validation failed',
      details: {
        validationErrors: [{ field: 'test', message: 'required' }]
      },
      timestamp: expect.any(String),
      context: {}
    });
  });

  it('should serialize standard Error objects', () => {
    const error = new Error('Standard error');
    const serialized = errorSerializer.serializer(error);

    expect(serialized).toEqual({
      code: ErrorCodes.CORE.UNKNOWN,
      message: 'Standard error',
      timestamp: expect.any(String),
      context: {}
    });
  });

  it('should handle errors with custom properties', () => {
    const error = new Error('Custom error');
    error.statusCode = 418;
    error.custom = 'value';
    
    const serialized = errorSerializer.serializer(error);

    expect(serialized).toEqual({
      code: ErrorCodes.CORE.UNKNOWN,
      message: 'Custom error',
      timestamp: expect.any(String),
      context: {}
    });
  });

  it('should handle null context', () => {
    const error = new Error('Test error');
    const serialized = errorSerializer.serializer(error, null);
    
    expect(serialized).toEqual({
      code: ErrorCodes.CORE.UNKNOWN,
      message: 'Test error',
      timestamp: expect.any(String),
      context: {}
    });
  });
});