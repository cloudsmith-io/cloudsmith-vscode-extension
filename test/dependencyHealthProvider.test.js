const assert = require("assert");
const { DependencyHealthProvider } = require("../views/dependencyHealthProvider");

suite("DependencyHealthProvider Test Suite", () => {
  test("getChildren() shows the signed-out state when disconnected before the first scan", async () => {
    const context = {
      secrets: {
        onDidChange() {},
        async get(key) {
          if (key === "cloudsmith-vsc.isConnected") {
            return "false";
          }
          return null;
        },
      },
    };

    const provider = new DependencyHealthProvider(context);
    const nodes = await provider.getChildren();

    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].getTreeItem().label, "Connect to Cloudsmith");
  });
});
