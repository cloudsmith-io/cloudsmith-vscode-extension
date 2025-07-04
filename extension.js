const vscode = require("vscode");
const { CloudsmithProvider } = require("./views/cloudsmithProvider");
const { helpProvider } = require("./views/helpProvider");
const cloudsmithApi = require("./util/cloudsmithAPI");
const path = require("path");
const env = require("dotenv").config({ path: path.resolve(__dirname, ".env") }); // Load from .env
const apiKey = env.parsed.CLOUDSMITH_API_KEY;

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  // logic here to handle auth and confirm connection is successful and set this accordingly. only dev for now, need to implement a proper way to handle this. extensions storage secrets.
  // eventually add sso support. For now it is just api key/ token based auth.
  if (!apiKey) {
    vscode.commands.executeCommand(
      "setContext",
      "cloudsmith.authenticated",
      false
    );
  } else {
    vscode.commands.executeCommand(
      "setContext",
      "cloudsmith.authenticated",
      true
    );
  }

  // Set main view, generate workspace data and pass to new tree view.
  const cloudsmithProvider = new CloudsmithProvider(() =>
    vscode.commands.executeCommand("cloudsmith.cloudsmithWorkspaces")
  );
  vscode.window.createTreeView("cloudsmithView", {
    treeDataProvider: cloudsmithProvider,
    showCollapseAll: true,
  });

  // Set Help & Feedback view. 
  const provider = new helpProvider();
  vscode.window.registerTreeDataProvider("helpView", provider);

 
  // register commands here
  context.subscriptions.push(

    // Register refresh command for main view
    vscode.commands.registerCommand("cloudsmith.refreshView", () => {
      cloudsmithProvider.refresh();
    }),

    // Register the copy-to-clipboard command
    vscode.commands.registerCommand("cloudsmith.copySelected", async (item) => {
      const text = typeof item === "string" ? item : item.label;
      const id = text.label.id;
      const value = text.label.value;
      if (text) {
        await vscode.env.clipboard.writeText(value.toString());
        vscode.window.showInformationMessage(
          `Copied ${id} to clipboard : ${value}`
        );
      } else {
        vscode.window.showWarningMessage("Nothing to copy.");
      }
    }),

    // Register the inspect package command
    vscode.commands.registerCommand(
      "cloudsmith.inspectPackage",
      async (item) => {
        const name = typeof item === "string" ? item : item.name;
        const workspace = typeof item === "string" ? item : item.namespace;
        const slug = typeof item === "string" ? item : item.slug;
        const identifier = slug.value.value;
        const repo = typeof item === "string" ? item : item.repository;
        if (slug) {
          const result = await cloudsmithApi.get(
            `packages/${workspace}/${repo}/${identifier}`,
            apiKey
          );
          const jsonContent = JSON.stringify(result, null, 2);

          const config = vscode.workspace.getConfiguration("cloudsmith");
          const inspectOutput = await config.get("inspectOutput");

          if (inspectOutput) {
            const doc = await vscode.workspace.openTextDocument({
              language: "json",
              content: jsonContent,
            });
            await vscode.window.showTextDocument(doc, { preview: true });
          } else {
            const outputChannel =
              vscode.window.createOutputChannel("Cloudsmith");
            outputChannel.clear();
            outputChannel.show(true);
            outputChannel.append(jsonContent);
          }

          vscode.window.showInformationMessage(
            `Inspecting package ${name} in repository ${repo}`
          );
        } else {
          vscode.window.showWarningMessage("Nothing to inspect.");
        }
      }
    ),

    // Register the open package command
    vscode.commands.registerCommand("cloudsmith.openPackage", async (item) => {
      const workspace = typeof item === "string" ? item : item.namespace;
      const repo = typeof item === "string" ? item : item.repository;
      const format = typeof item === "string" ? item : item.format;
      const name = typeof item === "string" ? item : item.name;
      const sha = typeof item === "string" ? item : item.version;
      const slug_perm = typeof item === "string" ? item : item.slug_perm;
      // get the value from the value object. Silly structure I know :(
      const version = sha.value.value;
      const identifier = slug_perm.value.value;

      //need to replace '/' in name as UI URL replaces these with _
      const pkg = name.replace("/", "_");

      const config = vscode.workspace.getConfiguration("cloudsmith");
      const useLegacyApp = await config.get("useLegacyWebApp"); // get legacy app setting from configuration settings

      if (slug_perm) {
        if (useLegacyApp) {
          // workflow handling depending on legacy app setting
          const url = `https://cloudsmith.io/~${workspace}/repos/${repo}/packages/detail/${format}/${pkg}/${version}`;
          vscode.env.openExternal(url);
        } else {
          const url = `https://app.cloudsmith.com/${workspace}/${repo}/${format}/${pkg}/${version}/${identifier}`;
          vscode.env.openExternal(url);
        }
      } else {
        vscode.window.showWarningMessage("Nothing to open.");
      }
    }),

    // Register command to open extension settings
    vscode.commands.registerCommand("cloudsmith.openSettings", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:Cloudsmith.cloudsmith"
      );
    })

  )

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
