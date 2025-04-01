// tests/index.test.js

import { ErrorTypes } from '../src/core/errors/types/index.js';
import { CoreError } from '../src/core/errors/Error.js';
import { ErrorCodes } from '../src/core/errors/index.js';

describe('Error System Integration', () => {
    describe('Error Types Export', () => {
        test('should export all error types', () => {
            expect(ErrorTypes.AccessError).toBeDefined();
            expect(ErrorTypes.AuthError).toBeDefined();
            expect(ErrorTypes.ConfigError).toBeDefined();
            expect(ErrorTypes.ModuleError).toBeDefined();
            expect(ErrorTypes.NetworkError).toBeDefined();
            expect(ErrorTypes.ServiceError).toBeDefined();
            expect(ErrorTypes.ValidationError).toBeDefined();
        });
    });

    describe('Error System Interaction', () => {
        test('all error types should extend CoreError', () => {
            Object.values(ErrorTypes).forEach(ErrorType => {
                const error = new ErrorType('TEST', 'Test message');
                expect(error).toBeInstanceOf(CoreError);
                expect(error).toBeInstanceOf(Error);
            });
        });

        test('error codes should be properly formatted', () => {
            Object.entries(ErrorTypes).forEach(([name, ErrorType]) => {
                const prefix = name.replace('Error', '').toUpperCase();
                const error = new ErrorType('TEST_CODE', 'Test message');
                expect(error.code).toBe(`${prefix}_TEST_CODE`);
            });
        });

        test('should handle error cause properly', () => {
            const cause = new Error('Original error');
            Object.values(ErrorTypes).forEach(ErrorType => {
                const error = new ErrorType('TEST', 'Test message', {}, { cause });
                expect(error.cause).toBe(cause);
                const json = error.toJSON();
                expect(json.cause).toBeDefined();
                expect(json.cause.message).toBe('Original error');
            });
        });
    });

    describe('Error Codes Integration', () => {
        test('should have valid error codes for each error type', () => {
            // Test that error codes exist for all error types
            Object.keys(ErrorTypes).forEach(type => {
                const baseType = type.replace('Error', '').toUpperCase();
                expect(ErrorCodes[baseType]).toBeDefined();
                expect(typeof ErrorCodes[baseType]).toBe('object');
            });
        });
    });
});