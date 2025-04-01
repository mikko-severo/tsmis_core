import * as ErrorTypes from '../../../../src/core/errors/types/index.js';
import { 
  AccessError,
  AuthError,
  ConfigError,
  ModuleError,
  NetworkError,
  ServiceError,
  ValidationError
} from '../../../../src/core/errors/types/index.js';

describe('Error Types Index', () => {
  test('should export all error types both as namespace and individual exports', () => {
    // Test namespace exports
    expect(ErrorTypes.AccessError).toBeDefined();
    expect(ErrorTypes.AuthError).toBeDefined();
    expect(ErrorTypes.ConfigError).toBeDefined();
    expect(ErrorTypes.ModuleError).toBeDefined();
    expect(ErrorTypes.NetworkError).toBeDefined();
    expect(ErrorTypes.ServiceError).toBeDefined();
    expect(ErrorTypes.ValidationError).toBeDefined();

    // Test individual exports
    expect(AccessError).toBeDefined();
    expect(AuthError).toBeDefined();
    expect(ConfigError).toBeDefined();
    expect(ModuleError).toBeDefined();
    expect(NetworkError).toBeDefined();
    expect(ServiceError).toBeDefined();
    expect(ValidationError).toBeDefined();

    // Verify they are the same
    expect(AccessError).toBe(ErrorTypes.AccessError);
    expect(AuthError).toBe(ErrorTypes.AuthError);
    expect(ConfigError).toBe(ErrorTypes.ConfigError);
    expect(ModuleError).toBe(ErrorTypes.ModuleError);
    expect(NetworkError).toBe(ErrorTypes.NetworkError);
    expect(ServiceError).toBe(ErrorTypes.ServiceError);
    expect(ValidationError).toBe(ErrorTypes.ValidationError);
  });

  test('should create instances of each error type', () => {
    expect(new AccessError('TEST', 'message')).toBeInstanceOf(AccessError);
    expect(new AuthError('TEST', 'message')).toBeInstanceOf(AuthError);
    expect(new ConfigError('TEST', 'message')).toBeInstanceOf(ConfigError);
    expect(new ModuleError('TEST', 'message')).toBeInstanceOf(ModuleError);
    expect(new NetworkError('TEST', 'message')).toBeInstanceOf(NetworkError);
    expect(new ServiceError('TEST', 'message')).toBeInstanceOf(ServiceError);
    expect(new ValidationError('TEST', 'message')).toBeInstanceOf(ValidationError);
  });
});