/**
 * Helper functions for testing OpenTelemetry resource attributes
 */
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/**
 * Asserts that a resource contains expected service attributes
 */
export function expectServiceAttributes(
  resource: any,
  expectedName: string,
  expectedVersion: string,
) {
  expect(resource.attributes).toEqual(
    expect.objectContaining({
      [ATTR_SERVICE_NAME]: expectedName,
      [ATTR_SERVICE_VERSION]: expectedVersion,
    }),
  );
}

/**
 * Asserts that a resource contains expected Logz.io-specific attributes
 */
export function expectLogzioAttributes(resource: any) {
  expect(resource.attributes).not.toHaveProperty('logzio.region');
  expect(resource.attributes).not.toHaveProperty('logzio.token');
}

/**
 * Asserts that a resource contains expected environment data
 */
export function expectEnvironmentAttributes(resource: any, expectedData: Record<string, any>) {
  expect(resource.attributes).toEqual(expect.objectContaining(expectedData));
}

/**
 * Asserts that a resource does NOT contain specified attributes
 */
export function expectMissingAttributes(resource: any, ...attributeKeys: string[]) {
  for (const key of attributeKeys) {
    expect(resource.attributes).not.toHaveProperty(key);
  }
}
