const vscode = require("vscode");
const { CloudsmithProvider } = require("./views/cloudsmithProvider");
const { helpProvider } = require("./views/helpProvider");
const cloudsmithApi = require("./util/cloudsmithAPI.js");
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

  const cloudsmithProvider = new CloudsmithProvider(() =>
    vscode.commands.executeCommand("cloudsmith.cloudsmithWorkspaces")
  );

  vscode.window.createTreeView("cloudsmithView", {
    treeDataProvider: cloudsmithProvider,
    showCollapseAll: true,
  });

  const provider = new helpProvider();
  vscode.window.registerTreeDataProvider("helpView", provider);

  /*********************************************************************
   *********      ----- WORKSPACE ENDPOINTS -----   *************************
   *********************************************************************/

  let showWorkspacesQP = vscode.commands.registerCommand(
    "cloudsmith.cloudsmithWorkspacesQP",
    async function () {
      // fetch workspaces to show in quickpick
      const workspaces = await vscode.commands.executeCommand(
        "cloudsmith.cloudsmithWorkspaces"
      );

      const items = workspaces.map((workspace) => {
        return {
          label: workspace.name,
          detail: workspace.slug,
        };
      });
      const workspace = await vscode.window.showQuickPick(items, {
        placeHolder: "You have access to the following Workspaces",
        matchOnDetail: true,
      });
      if (workspace == null) return;
      return workspace;
    }
  );

  /*********************************************************************
   *********      ----- REPO ENDPOINTS -----   *************************
   *********************************************************************/

  // Fetch Repos
  let getRepos = vscode.commands.registerCommand(
    "cloudsmith.cloudsmithReposList",
    async function () {
      const repos = await cloudsmithApi.get("repos", apiKey);
      return repos;
    }
  );

  let showReposQP = vscode.commands.registerCommand(
    "cloudsmith.cloudsmithReposListQP",
    async function () {
      const repos = await vscode.commands.executeCommand(
        "cloudsmith.cloudsmithReposList"
      );
      const items = repos.map((repo) => {
        return {
          label:
            repo.namespace +
            " | " +
            repo.name +
            " | " +
            "( " +
            repo.repository_type_str +
            ")",
          detail: repo.description,
          link:
            "https://app.cloudsmith.com/" + repo.namespace + "/" + repo.name,
        };
      });

      const repo = await vscode.window.showQuickPick(items, {
        placeHolder: "Your Cloudsmith repositories",
        matchOnDetail: true,
      });
      if (repo == null) return;

      vscode.env.openExternal(repo.link); //if user selects a repo it will prompt to open link to it in browser
    }
  );

  let showReposPerWorkspaceQP = vscode.commands.registerCommand(
    "cloudsmith.cloudsmithReposListWorkspaceQP",
    async function () {
      const workspace = await vscode.commands.executeCommand(
        "cloudsmith.cloudsmithWorkspacesQP"
      );
      const response = await cloudsmithApi.get(
        "repos/" + workspace.detail,
        apiKey
      );

      const items2 = response.map((repo) => {
        return {
          label:
            repo.namespace +
            " | " +
            repo.name +
            " | " +
            "( " +
            repo.repository_type_str +
            ")",
          detail: repo.description,
          link:
            "https://app.cloudsmith.com/" + repo.namespace + "/" + repo.name,
        };
      });

      const repo = await vscode.window.showQuickPick(items2, {
        placeHolder: "Your Cloudsmith repositories",
        matchOnDetail: true,
      });
      if (repo == null) return;

      vscode.env.openExternal(repo.link);
    }
  );

  // Creates new json template tab with a json template for end user to configure.
  let reposCreateTemplate = vscode.commands.registerCommand(
    "cloudsmith.cloudsmithReposCreateTemplate",
    async function () {
      const jsonData = {
        name: "",
        content_kind: "Standard",
        copy_packages: "Read",
        default_privilege: "None",
        delete_packages: "Admin",
        manage_entitlements_privilege: "Admin",
        move_packages: "Admin",
        replace_packages: "Write",
        repository_type_str: "Public",
        resync_packages: "Admin",
        scan_packages: "Read",
        storage_region: "default",
        use_entitlements_privilege: "Read",
        view_statistics: "Read",
      };

      const jsonContent = JSON.stringify(jsonData, null, 2);
      const doc = await vscode.workspace.openTextDocument({
        language: "json",
        content: jsonContent,
      });
      await vscode.window.showTextDocument(doc);
    }
  );

  // Create new repo using the open json file
  let reposCreateNew = vscode.commands.registerCommand(
    "cloudsmith.cloudsmithReposCreateNew",
    async function () {
      // get the json text from the active editor and add to API payload request
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage("No active text editor found.");
        return;
      }

      const namespaces = await cloudsmithApi.get("namespaces");
      const items = namespaces.map((namespace) => {
        return {
          label: namespace.name,
          detail: namespace.slug,
        };
      });

      const namespace = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a namespace to create the repository on",
        matchOnDetail: true,
      });
      if (namespace == null) return;

      const document = editor.document;
      const payload = document.getText();

      const url = "repos/" + namespace.detail + "/";
      var response = await cloudsmithApi.post(url, payload);

      const message =
        "Successfully created the repository called " + response.name;
      const buttonText = "Open in Cloudsmith";
      const link =
        "https://app.cloudsmith.com/" +
        response.namespace +
        "/" +
        response.name; // Replace with your link

      vscode.window
        .showInformationMessage(message, buttonText)
        .then((selection) => {
          if (selection === buttonText) {
            vscode.env.openExternal(vscode.Uri.parse(link));
          }
        });
    }
  );

  /*********************************************************************
   *********      ----- MISC REQUESTS -----   *************************
   *********************************************************************/

  // Register the copy-to-clipboard command
  context.subscriptions.push(
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
    })
  );

  // Register the inspect package command
  context.subscriptions.push(
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
            const outputChannel = vscode.window.createOutputChannel("Cloudsmith");
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
    )
  );

  // Register the open package command
  context.subscriptions.push(
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
    })
  );

  // Register command to open extension settings
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudsmith.openSettings", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:Cloudsmith.cloudsmith"
      );
    })
  );

  context.subscriptions.push(
    getRepos,
    showReposQP,
    reposCreateTemplate,
    reposCreateNew,
    showReposPerWorkspaceQP,
    showWorkspacesQP
  );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
