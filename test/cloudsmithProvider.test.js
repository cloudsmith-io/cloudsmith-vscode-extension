const assert = require("assert");
const vscode = require("vscode");
const { CloudsmithProvider } = require("../views/cloudsmithProvider");

suite("CloudsmithProvider Test Suite", () => {
  let originalExecuteCommand;
  let originalGetConfiguration;
  let originalShowWarningMessage;
  let commandCalls;
  let warningCalls;
  let defaultWorkspace;
  let treeView;
  let provider;

  const context = {
    secrets: {
      onDidChange() {},
      async get(key) {
        if (key === "cloudsmith-vsc.isConnected") {
          return "false";
        }
        return null;
      },
      async store() {},
    },
    globalState: {
      get() {
        return undefined;
      },
      async update() {},
    },
  };

  setup(() => {
    commandCalls = [];
    warningCalls = [];
    defaultWorkspace = "";
    treeView = { message: "ready" };
    provider = new CloudsmithProvider(context);
    provider.setTreeView(treeView);

    originalExecuteCommand = vscode.commands.executeCommand;
    originalGetConfiguration = vscode.workspace.getConfiguration;
    originalShowWarningMessage = vscode.window.showWarningMessage;

    vscode.commands.executeCommand = async (...args) => {
      commandCalls.push(args);
    };
    vscode.workspace.getConfiguration = () => ({
      get(key) {
        if (key === "defaultWorkspace") {
          return defaultWorkspace;
        }
        return "";
      },
    });
    vscode.window.showWarningMessage = async (...args) => {
      warningCalls.push(args);
      return undefined;
    };
  });

  teardown(() => {
    vscode.commands.executeCommand = originalExecuteCommand;
    vscode.workspace.getConfiguration = originalGetConfiguration;
    vscode.window.showWarningMessage = originalShowWarningMessage;
  });

  test("silent refresh shows the signed-out root state without warning after credentials are cleared", async () => {
    provider.refresh({ suppressMissingCredentialsWarning: true });

    const nodes = await provider.getChildren();

    assert.strictEqual(warningCalls.length, 0);
    assert.strictEqual(treeView.message, undefined);
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].getTreeItem().label, "Connect to Cloudsmith");
    assert.ok(
      commandCalls.some((call) => (
        call[0] === "setContext" &&
        call[1] === "cloudsmith.hasMultipleWorkspaces" &&
        call[2] === false
      ))
    );
  });

  test("silent refresh also shows the signed-out state when a default workspace is configured", async () => {
    defaultWorkspace = "workspace-a";
    provider.refresh({ suppressMissingCredentialsWarning: true });

    const nodes = await provider.getChildren();

    assert.strictEqual(warningCalls.length, 0);
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].getTreeItem().label, "Connect to Cloudsmith");
  });
});
