// src/core/errors/types/index.js

import { AccessError } from './AccessError.js';
import { AuthError } from './AuthError.js';
import { ConfigError } from './ConfigError.js';
import { EventError } from './EventError.js';
import { ModuleError } from './ModuleError.js';
import { NetworkError } from './NetworkError.js';
import { ServiceError } from './ServiceError.js';
import { RouterError } from './RouterError.js';
import { ValidationError } from './ValidationError.js';

// Export individual error types
export {
    AccessError,
    AuthError,
    ConfigError,
    EventError,
    ModuleError,
    NetworkError,
    ServiceError,
    ValidationError,
    RouterError
};

// Create the ErrorTypes namespace
const ErrorTypes = {
    AccessError,
    AuthError,
    ConfigError,
    EventError,
    ModuleError,
    NetworkError,
    ServiceError,
    ValidationError,
    RouterError
};

// Export ErrorTypes as both named and default export
export { ErrorTypes };
export default ErrorTypes;