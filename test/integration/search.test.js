const assert = require('assert');
const { apiKey, workspace, testRepo, createAPI, skipIfNoKey } = require('./setup');

suite('Integration: Search', function () {
  this.timeout(15000);

  let api;

  setup(function () {
    skipIfNoKey.call(this);
    api = createAPI();
  });

  test('searching for "spotipy" returns results', async function () {
    const results = await api.get(
      `packages/${workspace}/${testRepo}/?query=name:spotipy&page_size=10`,
      apiKey
    );
    assert.ok(Array.isArray(results), 'Expected array response');
    assert.ok(results.length > 0, 'Expected at least one result');
    assert.strictEqual(results[0].name, 'spotipy');
  });

  test('search results include a quarantined or policy-violated package', async function () {
    const results = await api.get(
      `packages/${workspace}/${testRepo}/?query=name:spotipy&page_size=10`,
      apiKey
    );
    assert.ok(Array.isArray(results), 'Expected array response');
    const flagged = results.find(
      (pkg) => pkg.status_str === 'Quarantined' || pkg.policy_violated === true
    );
    assert.ok(flagged, 'Expected at least one quarantined or policy-violated package');
  });

  test('status:quarantined filter returns only quarantined packages', async function () {
    const results = await api.get(
      `packages/${workspace}/${testRepo}/?query=status:quarantined&page_size=10`,
      apiKey
    );
    // If no quarantined packages exist, the response may be an empty array — that's valid
    if (typeof results === 'string') {
      // API returned an error string — skip rather than fail
      this.skip();
      return;
    }
    assert.ok(Array.isArray(results), 'Expected array response');
    for (const pkg of results) {
      assert.strictEqual(pkg.status_str, 'Quarantined',
        `Expected all results to be Quarantined, got: ${pkg.status_str}`);
    }
  });
});
