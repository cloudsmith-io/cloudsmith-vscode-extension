const assert = require("assert");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const { CredentialManager } = require("../util/credentialManager");
const {
  UpstreamChecker,
  SUPPORTED_UPSTREAM_FORMATS,
} = require("../util/upstreamChecker");

suite("UpstreamChecker Test Suite", () => {
  let originalMakeRequest;
  let originalGetApiKey;
  let formatResponses;
  let requestCount;
  let store;
  let context;

  setup(() => {
    originalMakeRequest = CloudsmithAPI.prototype.makeRequest;
    originalGetApiKey = CredentialManager.prototype.getApiKey;
    formatResponses = {};
    requestCount = 0;
    store = new Map();
    context = {
      globalState: {
        get(key) {
          return store.get(key);
        },
        async update(key, value) {
          if (value === undefined) {
            store.delete(key);
            return;
          }
          store.set(key, value);
        },
      },
    };

    CredentialManager.prototype.getApiKey = async () => "test-api-key";
    CloudsmithAPI.prototype.makeRequest = async function(endpoint) {
      requestCount += 1;
      const match = endpoint.match(/upstream\/([^/]+)\/$/);
      const format = match ? match[1] : null;
      const response = formatResponses[format];

      if (response instanceof Error) {
        throw response;
      }

      if (typeof response === "function") {
        return response();
      }

      if (response !== undefined) {
        return response;
      }

      return [];
    };
  });

  teardown(() => {
    CloudsmithAPI.prototype.makeRequest = originalMakeRequest;
    CredentialManager.prototype.getApiKey = originalGetApiKey;
  });

  function createCachedEntry(overrides = {}) {
    return {
      timestamp: Date.now(),
      successfulFormats: 1,
      groupedUpstreams: {
        python: [
          { name: "PyPI", upstream_url: "https://pypi.org/simple/" },
        ],
      },
      ...overrides,
    };
  }

  async function assertInvalidCachedEntry(entry) {
    const checker = new UpstreamChecker(context);
    const cacheKey = checker._getRepositoryUpstreamCacheKey("workspace-a", "repo-a");
    store.set(cacheKey, entry);

    const cachedState = checker._getCachedRepositoryUpstreamState("workspace-a", "repo-a");

    await Promise.resolve();

    assert.strictEqual(cachedState, null);
    assert.strictEqual(store.has(cacheKey), false);
  }

  test("aggregates repository upstreams across formats and reuses the shared cache", async () => {
    formatResponses = {
      python: [
        { name: "PyPI", upstream_url: "https://pypi.org/simple/" },
        { name: "Internal mirror", upstream_url: "https://mirror.example/python" },
        { name: "Legacy", upstream_url: "https://legacy.example/python" },
      ],
      npm: [
        { name: "npmjs", upstream_url: "https://registry.npmjs.org/" },
        { name: "Disabled", upstream_url: "https://disabled.example/npm", is_active: false },
      ],
      docker: [
        { name: "Docker Hub", upstream_url: "https://registry-1.docker.io/" },
      ],
      conda: "Response status: 404 - Not Found - ",
    };

    const checker = new UpstreamChecker(context);
    const firstState = await checker.getRepositoryUpstreamState("workspace-a", "repo-a");

    assert.strictEqual(requestCount, SUPPORTED_UPSTREAM_FORMATS.length);
    assert.strictEqual(firstState.total, 6);
    assert.strictEqual(firstState.active, 5);
    assert.deepStrictEqual(firstState.failedFormats, []);
    assert.strictEqual(firstState.groupedUpstreams.get("python").length, 3);
    assert.strictEqual(firstState.groupedUpstreams.get("npm").length, 2);
    assert.strictEqual(firstState.groupedUpstreams.get("docker").length, 1);
    assert.strictEqual(firstState.groupedUpstreams.get("docker")[0].format, "docker");
    assert.strictEqual(store.size, 1);

    const secondState = await checker.getRepositoryUpstreamState("workspace-a", "repo-a");

    assert.strictEqual(requestCount, SUPPORTED_UPSTREAM_FORMATS.length);
    assert.strictEqual(secondState.total, 6);
    assert.strictEqual(secondState.active, 5);
    assert.strictEqual(secondState.groupedUpstreams.get("python")[0].name, "Internal mirror");
  });

  test("does not cache partial upstream data when any format fails", async () => {
    formatResponses = {
      python: [
        { name: "PyPI", upstream_url: "https://pypi.org/simple/" },
      ],
      npm: () => {
        throw new Error("Response status: 503 - Service Unavailable - ");
      },
    };

    const checker = new UpstreamChecker(context);
    const firstState = await checker.getRepositoryUpstreamState("workspace-a", "repo-a");

    assert.ok(firstState.failedFormats.includes("npm"));
    assert.strictEqual(firstState.total, 1);
    assert.strictEqual(firstState.active, 1);
    assert.strictEqual(store.size, 0);

    await checker.getRepositoryUpstreamState("workspace-a", "repo-a");

    assert.strictEqual(requestCount, SUPPORTED_UPSTREAM_FORMATS.length * 2);
    assert.strictEqual(store.size, 0);
  });

  test("treats missing timestamp as an invalid cached repository upstream state", async () => {
    const entry = createCachedEntry();
    delete entry.timestamp;
    await assertInvalidCachedEntry(entry);
  });

  test("treats non-number timestamp as an invalid cached repository upstream state", async () => {
    await assertInvalidCachedEntry(createCachedEntry({ timestamp: "123" }));
  });

  test("treats non-finite timestamp as an invalid cached repository upstream state", async () => {
    await assertInvalidCachedEntry(createCachedEntry({ timestamp: Number.NaN }));
  });

  test("treats missing groupedUpstreams as an invalid cached repository upstream state", async () => {
    const entry = createCachedEntry();
    delete entry.groupedUpstreams;
    await assertInvalidCachedEntry(entry);
  });

  test("treats non-object groupedUpstreams as an invalid cached repository upstream state", async () => {
    await assertInvalidCachedEntry(createCachedEntry({ groupedUpstreams: [] }));
  });

  test("treats expired cached repository upstream state as invalid", () => {
    const checker = new UpstreamChecker(context);
    const cacheKey = checker._getRepositoryUpstreamCacheKey("workspace-a", "repo-a");
    store.set(cacheKey, createCachedEntry({ timestamp: Date.now() - (11 * 60 * 1000) }));

    const cachedState = checker._getCachedRepositoryUpstreamState("workspace-a", "repo-a");

    assert.strictEqual(cachedState, null);
  });

  test("accepts a valid cached repository upstream state", () => {
    const checker = new UpstreamChecker(context);
    const cacheKey = checker._getRepositoryUpstreamCacheKey("workspace-a", "repo-a");
    store.set(cacheKey, createCachedEntry({ successfulFormats: 7 }));

    const cachedState = checker._getCachedRepositoryUpstreamState("workspace-a", "repo-a");

    assert.ok(cachedState);
    assert.strictEqual(cachedState.successfulFormats, 7);
    assert.strictEqual(cachedState.total, 1);
    assert.strictEqual(cachedState.active, 1);
    assert.strictEqual(cachedState.groupedUpstreams.get("python").length, 1);
  });

  test("returns computed upstream state when repository cache persistence fails", async () => {
    formatResponses = {
      python: [
        { name: "PyPI", upstream_url: "https://pypi.org/simple/" },
      ],
      npm: [
        { name: "npmjs", upstream_url: "https://registry.npmjs.org/" },
      ],
    };

    const originalUpdate = context.globalState.update;
    const logCalls = [];

    context.globalState.update = async () => {
      throw new Error("quota exceeded");
    };

    try {
      const checker = new UpstreamChecker(context);
      checker._logRepositoryUpstreamCacheError = (...args) => logCalls.push(args);
      const state = await checker.getRepositoryUpstreamState("workspace-a", "repo-a");

      assert.strictEqual(state.total, 2);
      assert.strictEqual(state.active, 2);
      assert.deepStrictEqual(state.failedFormats, []);
      assert.strictEqual(store.size, 0);
      assert.strictEqual(logCalls.length, 1);
      assert.deepStrictEqual(logCalls[0].slice(0, 3), [
        "persist",
        "workspace-a",
        "repo-a",
      ]);
      assert.strictEqual(logCalls[0][3].message, "quota exceeded");
    } finally {
      context.globalState.update = originalUpdate;
    }
  });
});
