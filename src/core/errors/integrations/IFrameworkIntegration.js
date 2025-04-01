// src/core/errors/integrations/IFrameworkIntegration.js

/**
 * Interface for framework error integration
 * @interface
 */
export class IFrameworkIntegration {
  /**
   * Initialize error handling for framework
   * @param {any} framework - Framework instance
   * @param {Object} options - Integration options
   */
  initialize(framework, options = {}) {
    throw new Error('initialize() must be implemented');
  }

  /**
   * Serialize error for framework response
   * @param {Error} error - Error to serialize
   * @returns {Object} Serialized error
   */
  serializeError(error) {
    throw new Error('serializeError() must be implemented');
  }

  /**
   * Map framework error to core error
   * @param {Error} frameworkError - Framework-specific error
   * @returns {CoreError} Mapped core error
   */
  mapError(frameworkError) {
    throw new Error('mapError() must be implemented');
  }
}