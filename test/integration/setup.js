// Shared setup for integration tests that run against the live Cloudsmith API.
//
// Usage:
//   CLOUDSMITH_TEST_API_KEY=your_key_here npm test
//
// When CLOUDSMITH_TEST_API_KEY is not set, all integration tests are skipped.

const { CloudsmithAPI } = require('../../util/cloudsmithAPI');

// Test constants — known workspace and package for assertions
const apiKey = process.env.CLOUDSMITH_TEST_API_KEY || null;
const workspace = 'dl-technology-consulting';
const testRepo = 'flask-primary-web-app';
const testPackageSlug = '1yqk96alztTfimXJ'; // spotipy 2.25.0

// Minimal mock context — just enough for CloudsmithAPI constructor.
// The apiKey parameter on each call bypasses CredentialManager entirely.
const mockContext = {
  secrets: { get: async () => null, store: async () => {} },
  globalState: { get: () => undefined, update: () => {} },
};

/**
 * Create a CloudsmithAPI instance suitable for integration tests.
 */
function createAPI() {
  return new CloudsmithAPI(mockContext);
}

/**
 * Call at the top of an integration test suite to skip when no API key is set.
 * Must be called inside suite() with a regular function (not arrow) for `this` binding.
 *
 * Example:
 *   suite('Integration: Search', function () {
 *     setup(function () { skipIfNoKey.call(this); });
 *     ...
 *   });
 */
function skipIfNoKey() {
  if (!apiKey) {
    this.skip();
  }
}

module.exports = {
  apiKey,
  workspace,
  testRepo,
  testPackageSlug,
  mockContext,
  createAPI,
  skipIfNoKey,
};
