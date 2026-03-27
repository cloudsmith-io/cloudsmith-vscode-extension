const assert = require("assert");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const { ConnectionManager } = require("../util/connectionManager");
const workspaceRepositoryFetcher = require("../util/workspaceRepositoryFetcher");
const { CloudsmithProvider } = require("../views/cloudsmithProvider");

suite("CloudsmithProvider Test Suite", () => {
  let originalConnect;
  let originalGet;
  let originalFetchWorkspaceRepositories;
  let provider;
  let cacheUpdates;

  const context = {
    globalState: {
      update(key, value) {
        cacheUpdates.push({ key, value });
      },
    },
  };

  setup(() => {
    cacheUpdates = [];
    provider = new CloudsmithProvider(context);

    originalConnect = ConnectionManager.prototype.connect;
    originalGet = CloudsmithAPI.prototype.get;
    originalFetchWorkspaceRepositories =
      workspaceRepositoryFetcher.fetchWorkspaceRepositories;

    ConnectionManager.prototype.connect = async () => "true";
    CloudsmithAPI.prototype.get = async endpoint => {
      if (endpoint.startsWith("quota/")) {
        return {
          usage: {
            display: {
              storage: { used: "0 GB", plan_limit: "10 GB", percentage_used: "0" },
              bandwidth: { used: "0 GB", plan_limit: "10 GB", percentage_used: "0" },
            },
          },
        };
      }

      return [];
    };
  });

  teardown(() => {
    ConnectionManager.prototype.connect = originalConnect;
    CloudsmithAPI.prototype.get = originalGet;
    workspaceRepositoryFetcher.fetchWorkspaceRepositories =
      originalFetchWorkspaceRepositories;
  });

  test("loads repositories for the default workspace through the shared fetcher", async () => {
    workspaceRepositoryFetcher.fetchWorkspaceRepositories = async () => ({
      repositories: [
        { name: "repo-a", slug: "repo-a" },
        { name: "repo-b", slug: "repo-b" },
      ],
      error: null,
      warning: null,
      partial: false,
    });

    const nodes = await provider.getRepositories("workspace-a");

    assert.strictEqual(nodes.length, 3);
    assert.strictEqual(nodes[0].workspaceName, "workspace-a");
    assert.strictEqual(nodes[1].name, "repo-a");
    assert.strictEqual(nodes[2].name, "repo-b");
    assert.strictEqual(cacheUpdates.length, 1);
    assert.strictEqual(cacheUpdates[0].key, "CloudsmithCache");
    assert.deepStrictEqual(cacheUpdates[0].value.workspaces, [
      { name: "workspace-a", slug: "workspace-a" },
    ]);
  });
});
