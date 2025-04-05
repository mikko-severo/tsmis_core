// src/core/errors/index.js

import { CoreError } from "./Error.js";
import {
  ErrorTypes as TypedErrors,
  AccessError,
  AuthError,
  ConfigError,
  EventError,
  ModuleError,
  NetworkError,
  ServiceError,
  ValidationError,
} from "./types/index.js";

// Create complete ErrorTypes including CoreError
export const ErrorTypes = {
  CoreError,
  ...TypedErrors,
};

// Export individual error classes
export {
  CoreError,
  AccessError,
  AuthError,
  ConfigError,
  EventError,
  ModuleError,
  NetworkError,
  ServiceError,
  ValidationError,
};

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Core errors
  CORE: {
    UNKNOWN: "UNKNOWN_ERROR",
    INITIALIZATION: "INITIALIZATION_FAILED",
    VALIDATION: "VALIDATION_FAILED",
  },

  // Module related
  MODULE: {
    INITIALIZATION: "INITIALIZATION_FAILED",
    REGISTRATION: "REGISTRATION_FAILED",
    DEPENDENCY: "DEPENDENCY_ERROR",
    ROUTE: "ROUTE_ERROR",
  },

  // Event related
  EVENT: {
    INITIALIZATION: "INITIALIZATION_FAILED",
    EMISSION_FAILED: "EMISSION_FAILED",
    SUBSCRIPTION_FAILED: "SUBSCRIPTION_FAILED",
    INVALID_PATTERN: "INVALID_PATTERN",
    INVALID_EVENT_NAME: "INVALID_EVENT_NAME",
    QUEUE_PROCESSING_FAILED: "QUEUE_PROCESSING_FAILED",
    HANDLER_NOT_FOUND: "HANDLER_NOT_FOUND",
    INVALID_HANDLER:"INVALID_HANDLER",
    SHUTDOWN_FAILED:"SHUTDOWN_FAILED",
    HANDLER_ERROR: "HANDLER_ERROR",
    MISSING_DEPENDENCIES:"MISSING_DEPENDENCIES",
    INVALID_DEPENDENCY:"INVALID_DEPENDENCY",
    NOT_INITIALIZED:"NOT_INITIALIZED"
  },

  // Service related
  SERVICE: {
    INITIALIZATION: "INITIALIZATION_FAILED",
    CONFIGURATION: "CONFIGURATION_ERROR",
    DEPENDENCY: "DEPENDENCY_ERROR",
    RUNTIME: "RUNTIME_ERROR",
  },

  // Configuration related
  CONFIG: {
    VALIDATION: "VALIDATION_FAILED",
    MISSING: "MISSING_REQUIRED",
    INVALID: "INVALID_VALUE",
  },

  // Validation related
  VALIDATION: {
    SCHEMA: "SCHEMA_VALIDATION_FAILED",
    TYPE: "INVALID_TYPE",
    REQUIRED: "REQUIRED_FIELD_MISSING",
    FAILED: "VALIDATION_FAILED", // Added for validation errors
  },

  // Network related
  NETWORK: {
    REQUEST: "REQUEST_FAILED",
    RESPONSE: "RESPONSE_ERROR",
    TIMEOUT: "REQUEST_TIMEOUT",
    ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND", // Added for 404 errors
  },

  // Router related
  ROUTER: {
    INITIALIZATION_FAILED: "INITIALIZATION_FAILED",
    ALREADY_INITIALIZED: "ALREADY_INITIALIZED",
    NOT_INITIALIZED: "NOT_INITIALIZED",
    ROUTE_CONFLICT: "ROUTE_CONFLICT",
    INVALID_ROUTE: "INVALID_ROUTE",
    INVALID_MODULE_ID: "INVALID_MODULE_ID",
    INVALID_METHOD: "INVALID_METHOD",
    INVALID_PATH: "INVALID_PATH",
    INVALID_HANDLER: "INVALID_HANDLER",
    INVALID_MIDDLEWARE: "INVALID_MIDDLEWARE",
    ADAPTER_NOT_FOUND: "ADAPTER_NOT_FOUND",
    INVALID_ADAPTER: "INVALID_ADAPTER",
    ROUTE_REGISTRATION_FAILED: "ROUTE_REGISTRATION_FAILED",
    ROUTES_APPLICATION_FAILED: "ROUTES_APPLICATION_FAILED",
    SHUTDOWN_FAILED: "SHUTDOWN_FAILED"
  },

  // Authentication related
  AUTH: {
    UNAUTHORIZED: "UNAUTHORIZED",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    INVALID_TOKEN: "INVALID_TOKEN",
  },

  // Authorization related
  ACCESS: {
    FORBIDDEN: "FORBIDDEN",
    INSUFFICIENT_RIGHTS: "INSUFFICIENT_RIGHTS",
    RESOURCE_ACCESS_DENIED: "RESOURCE_ACCESS_DENIED",
  },
};

export function createErrorFromResponse(
  response,
  defaultMessage = "Unknown error occurred"
) {
  const errorData = response.data || response;

  // Map error names to constructors from ErrorTypes
  const ErrorConstructor = ErrorTypes[errorData.name] || CoreError;

  return new ErrorConstructor(
    errorData.code || ErrorCodes.CORE.UNKNOWN,
    errorData.message || defaultMessage,
    errorData.details || {},
    { cause: response }
  );
}

export default ErrorTypes;
