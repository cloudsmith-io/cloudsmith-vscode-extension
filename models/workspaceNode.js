// Workspace node treeview

const vscode = require("vscode");
const path = require("path");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const repositoryNode = require("./repositoryNode");
const { WorkspaceInfoNode } = require("./workspaceInfoNode");

class WorkspaceNode {
  constructor(item, context) {
    this.context = context;
    this.name = item.name;
    this.slug = item.slug;
    this.workspace = item.slug;
    this.repos = [];
  }

  getTreeItem() {
    const workspace = this.name;
    let iconPath = {
      light: path.join(__filename, "..", "..", "media", "workspace_light.svg"),
      dark: path.join(__filename, "..", "..", "media", "workspace_dark.svg"),
    };
    return {
      label: workspace,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "workspace",
      iconPath: iconPath,
    };
  }

  async getRepositories() {
    const context = this.context;
    const workspace = this.workspace;
    const cloudsmithAPI = new CloudsmithAPI(context);
    const repositories = await cloudsmithAPI.get(
      "repos/" + workspace + "/?sort=name"
    );

    const RepositoryNodes = [];
    if (typeof repositories === "string") {
      vscode.window.showErrorMessage(
        `Could not load repositories for ${workspace}. ${repositories}`
      );
      return RepositoryNodes;
    }

    if (!Array.isArray(repositories)) {
      return RepositoryNodes;
    }

    for (const repo of repositories) {
      const repositoryNodeInst = new repositoryNode(
        repo,
        this.slug,
        this.context
      );
      RepositoryNodes.push(repositoryNodeInst);
    }

    context.globalState.update("CloudsmithCache", {
      name: "Repositories",
      lastSync: Date.now(),
      workspaces: repositories,
    });
    return RepositoryNodes;
  }

  async getChildren() {
    let quotaData = null;

    try {
      const cloudsmithAPI = new CloudsmithAPI(this.context);
      const result = await cloudsmithAPI.get(`quota/${this.workspace}/`);

      if (typeof result !== "string" && result && result.usage) {
        quotaData = result;
      }
    } catch {
      // Quota access is optional for this node.
    }

    const children = [];
    children.push(new WorkspaceInfoNode(this.name || this.workspace, quotaData));

    const repos = await this.getRepositories();
    children.push(...repos);

    return children;
  }
}

module.exports = WorkspaceNode;
