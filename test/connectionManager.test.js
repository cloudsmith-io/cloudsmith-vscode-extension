const assert = require("assert");
const vscode = require("vscode");
const { ConnectionManager } = require("../util/connectionManager");

suite("ConnectionManager Test Suite", () => {
  let originalShowWarningMessage;
  let originalExecuteCommand;
  let warningCalls;
  let commandCalls;

  const context = {
    secrets: {
      async get() {
        return null;
      },
      async store() {},
    },
  };

  setup(() => {
    warningCalls = [];
    commandCalls = [];

    originalShowWarningMessage = vscode.window.showWarningMessage;
    originalExecuteCommand = vscode.commands.executeCommand;

    vscode.window.showWarningMessage = async (...args) => {
      warningCalls.push(args);
      return undefined;
    };
    vscode.commands.executeCommand = async (...args) => {
      commandCalls.push(args);
    };
  });

  teardown(() => {
    vscode.window.showWarningMessage = originalShowWarningMessage;
    vscode.commands.executeCommand = originalExecuteCommand;
  });

  test("connect() warns for missing credentials in interactive flows", async () => {
    const manager = new ConnectionManager(context);

    const status = await manager.connect();

    assert.strictEqual(status, "false");
    assert.strictEqual(warningCalls.length, 1);
    assert.strictEqual(warningCalls[0][0], "No credentials configured!");
    assert.deepStrictEqual(commandCalls, [
      ["setContext", "cloudsmith.connected", false],
    ]);
  });

  test("connect() can skip the missing credentials warning for non-interactive flows", async () => {
    const manager = new ConnectionManager(context);

    const status = await manager.connect({ promptOnMissingCredentials: false });

    assert.strictEqual(status, "false");
    assert.strictEqual(warningCalls.length, 0);
    assert.deepStrictEqual(commandCalls, [
      ["setContext", "cloudsmith.connected", false],
    ]);
  });
});
