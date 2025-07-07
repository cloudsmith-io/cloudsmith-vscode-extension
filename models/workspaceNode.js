const vscode = require("vscode");
const path = require("path");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const repositoryNode = require("./repositoryNode");

class WorkspaceNode {
  constructor(item, context) {
    this.context = context;
    this.name = item.name;
    this.slug = item.slug;
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
    const workspace = this.slug;

	const cloudsmithAPI = new CloudsmithAPI(this.context);
    const repositories = await cloudsmithAPI.get(
      "repos/" + workspace + "/?sort=name"
    );

    const RepositoryNodes = [];
    if (repositories) {
      for (const repo of repositories) {
        const repositoryNodeInst = new repositoryNode(
          repo,
          this.name,
          this.context
        );
        RepositoryNodes.push(repositoryNodeInst);
      }
    }
    return RepositoryNodes;
  }

  async getChildren() {
    const repos = await this.getRepositories();

    return repos.map((item) => {
      return new repositoryNode(item, this.slug, this.context);
    });
  }
}

module.exports = WorkspaceNode;
