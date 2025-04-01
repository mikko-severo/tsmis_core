import {
  AccessError,
  AuthError,
  ConfigError,
  ModuleError,
  NetworkError,
  ServiceError,
  ValidationError,
} from "../../../../src/core/errors/types/index.js";
import * as ErrorTypes from "../../../../src/core/errors/types/index.js";

describe("Error Types", () => {
  describe("Error Type Exports", () => {
    it("should export all expected error classes", () => {
      expect(ErrorTypes).toHaveProperty("AccessError");
      expect(ErrorTypes).toHaveProperty("AuthError");
      expect(ErrorTypes).toHaveProperty("ConfigError");
      expect(ErrorTypes).toHaveProperty("ModuleError");
      expect(ErrorTypes).toHaveProperty("NetworkError");
      expect(ErrorTypes).toHaveProperty("ServiceError");
      expect(ErrorTypes).toHaveProperty("ValidationError");
    });
  });
  describe("ConfigError", () => {
    it("should create ConfigError with correct properties", () => {
      const error = new ConfigError("INVALID_CONFIG", "Invalid configuration", {
        key: "test",
      });
      expect(error.name).toBe("ConfigError");
      expect(error.code).toBe("CONFIG_INVALID_CONFIG");
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ key: "test" });
    });
  });

  describe("ModuleError", () => {
    it("should create ModuleError with correct properties", () => {
      const error = new ModuleError(
        "INIT_FAILED",
        "Module initialization failed",
        { module: "test" }
      );
      expect(error.name).toBe("ModuleError");
      expect(error.code).toBe("MODULE_INIT_FAILED");
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ module: "test" });
    });
  });

  describe("ServiceError", () => {
    it("should create ServiceError with correct properties", () => {
      const error = new ServiceError("SERVICE_DOWN", "Service unavailable", {
        service: "test",
      });
      expect(error.name).toBe("ServiceError");
      expect(error.code).toBe("SERVICE_SERVICE_DOWN");
      expect(error.statusCode).toBe(503);
      expect(error.details).toEqual({ service: "test" });
    });

    it("should handle error cause properly", () => {
      const cause = new Error("Original error");
      const error = new ServiceError("TEST", "Test error", {}, { cause });
      expect(error.cause).toBe(cause);
      const json = error.toJSON();
      expect(json.cause).toBeDefined();
      expect(json.cause.message).toBe("Original error");
    });
  });

  describe("ValidationError", () => {
    test("should handle non-array validation errors in constructor", () => {
      const error = new ValidationError("TEST", "message", {
        validationErrors: "invalid",
      });
      expect(error.validationErrors).toEqual([]);
    });

    test("should handle missing validation errors in fromJSON", () => {
      const error = ValidationError.fromJSON({
        code: "TEST",
        message: "message",
      });
      expect(error.validationErrors).toEqual([]);
    });
    it("should handle various types of validationErrors correctly", () => {
      const err1 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: "not an array",
      });
      expect(err1.validationErrors).toEqual([]);

      const err2 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: 42,
      });
      expect(err2.validationErrors).toEqual([]);

      const err3 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: {},
      });
      expect(err3.validationErrors).toEqual([]);

      const err4 = new ValidationError("INVALID_INPUT", "Invalid input", {});
      expect(err4.validationErrors).toEqual([]);

      const err5 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: null,
      });
      expect(err5.validationErrors).toEqual([]);

      const err6 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: [],
      });
      expect(err6.validationErrors).toEqual([]);

      const err7 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: ["error1", "error2"],
      });
      expect(err7.validationErrors).toEqual(["error1", "error2"]);
    });

    it("should store validation errors when provided", () => {
      const errors = [{ field: "email", message: "Invalid email" }];
      const err = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: errors,
      });
      expect(err.validationErrors).toEqual(errors);
    });

    it("should default to an empty array when validationErrors is not an array", () => {
      const err1 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: "not an array",
      });
      expect(err1.validationErrors).toEqual([]);

      const err2 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: 42,
      });
      expect(err2.validationErrors).toEqual([]);

      const err3 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: {},
      });
      expect(err3.validationErrors).toEqual([]);

      const err4 = new ValidationError("INVALID_INPUT", "Invalid input", {});
      expect(err4.validationErrors).toEqual([]);
    });

    it("should properly serialize and deserialize validation errors", () => {
      const errors = [{ field: "username", message: "Username is required" }];
      const originalError = new ValidationError(
        "MISSING_FIELD",
        "Username is missing",
        { validationErrors: errors }
      );

      const json = originalError.toJSON();
      expect(json.validationErrors).toEqual(errors);

      const recreatedError = ValidationError.fromJSON(json);
      expect(recreatedError.validationErrors).toEqual(errors);
    });
    it("should fallback to an empty array when validationErrors is missing or invalid", () => {
      const err1 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: undefined,
      });
      expect(err1.validationErrors).toEqual([]);

      const err2 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: 42,
      });
      expect(err2.validationErrors).toEqual([]);

      const err3 = new ValidationError("INVALID_INPUT", "Invalid input", {
        validationErrors: {},
      });
      expect(err3.validationErrors).toEqual([]);

      const err4 = new ValidationError("INVALID_INPUT", "Invalid input", {});
      expect(err4.validationErrors).toEqual([]);
    });
    it("should create ValidationError with correct properties", () => {
      const validationErrors = [{ field: "test", message: "Required" }];
      const error = new ValidationError("INVALID_INPUT", "Invalid input data", {
        validationErrors,
      });

      expect(error.name).toBe("ValidationError");
      expect(error.code).toBe("VALIDATION_INVALID_INPUT");
      expect(error.statusCode).toBe(400);
      expect(error.validationErrors).toEqual(validationErrors);
    });

    it("should handle empty validation errors", () => {
      const error = new ValidationError("TEST", "Test error");
      expect(error.validationErrors).toEqual([]);
    });

    it("should properly serialize and deserialize validation errors", () => {
      const validationErrors = [{ field: "test", message: "Required" }];
      const error = new ValidationError("TEST", "Test error", {
        validationErrors,
      });

      const json = error.toJSON();
      expect(json.validationErrors).toEqual(validationErrors);

      const restored = ValidationError.fromJSON(json);
      expect(restored.validationErrors).toEqual(validationErrors);
    });
  });

  describe("NetworkError", () => {
    it("should create NetworkError with correct properties", () => {
      const error = new NetworkError(
        "REQUEST_FAILED",
        "Network request failed",
        {
          url: "http://test.com",
          statusCode: 404,
        }
      );
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe("NETWORK_REQUEST_FAILED");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({
        url: "http://test.com",
        statusCode: 404,
      });
    });

    it("should use default status code if not provided", () => {
      const error = new NetworkError(
        "REQUEST_FAILED",
        "Network request failed"
      );
      expect(error.statusCode).toBe(503);
    });
  });

  describe("AuthError", () => {
    it("should create AuthError with correct properties", () => {
      const error = new AuthError(
        "INVALID_TOKEN",
        "Invalid authentication token",
        { token: "test" }
      );
      expect(error.name).toBe("AuthError");
      expect(error.code).toBe("AUTH_INVALID_TOKEN");
      expect(error.statusCode).toBe(401);
      expect(error.details).toEqual({ token: "test" });
    });
  });

  describe("AccessError", () => {
    it("should create AccessError with correct properties", () => {
      const error = new AccessError("FORBIDDEN", "Access denied", {
        resource: "test",
      });
      expect(error.name).toBe("AccessError");
      expect(error.code).toBe("ACCESS_FORBIDDEN");
      expect(error.statusCode).toBe(403);
      expect(error.details).toEqual({ resource: "test" });
    });
  });

  describe("Error Creation with Options", () => {
    const errorTypes = [
      { Type: AccessError, prefix: "ACCESS" },
      { Type: AuthError, prefix: "AUTH" },
      { Type: ConfigError, prefix: "CONFIG" },
      { Type: ModuleError, prefix: "MODULE" },
      { Type: NetworkError, prefix: "NETWORK" },
      { Type: ServiceError, prefix: "SERVICE" },
      { Type: ValidationError, prefix: "VALIDATION" },
    ];

    test.each(errorTypes)(
      "should create $Type.name with cause",
      ({ Type, prefix }) => {
        const cause = new Error("Cause error");
        const error = new Type("TEST", "Test message", {}, { cause });

        expect(error.code).toBe(`${prefix}_TEST`);
        expect(error.cause).toBe(cause);

        const json = error.toJSON();
        expect(json.cause).toBeDefined();
        expect(json.cause.message).toBe("Cause error");
      }
    );
  });
});
