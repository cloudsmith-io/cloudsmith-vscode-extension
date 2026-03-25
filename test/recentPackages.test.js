const assert = require("assert");

suite("RecentPackages Test Suite", () => {
  let recentPackages;

  setup(() => {
    delete require.cache[require.resolve("../util/recentPackages")];
    recentPackages = require("../util/recentPackages");
  });

  test("add() preserves install-command metadata fields", () => {
    recentPackages.add({
      name: "nginx",
      format: "docker",
      version: "1.25",
      namespace: "workspace-a",
      repository: "containers",
      checksum_sha256: "abc123",
      cdn_url: "https://cdn.example.com/nginx.tar",
      filename: "nginx.tar",
    });

    const all = recentPackages.getAll();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].checksum_sha256, "abc123");
    assert.strictEqual(all[0].cdn_url, "https://cdn.example.com/nginx.tar");
    assert.strictEqual(all[0].filename, "nginx.tar");
  });

  test("add() keeps identical package coordinates from different workspaces", () => {
    recentPackages.add({
      name: "shared-lib",
      format: "raw",
      version: "1.0.0",
      namespace: "workspace-a",
      repository: "downloads",
    });
    recentPackages.add({
      name: "shared-lib",
      format: "raw",
      version: "1.0.0",
      namespace: "workspace-b",
      repository: "downloads",
    });

    const all = recentPackages.getAll();
    assert.strictEqual(all.length, 2);
    assert.strictEqual(all[0].namespace, "workspace-b");
    assert.strictEqual(all[1].namespace, "workspace-a");
  });
});
