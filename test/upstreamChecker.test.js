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
});
