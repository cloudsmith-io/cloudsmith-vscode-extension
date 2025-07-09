const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const packageNode = require("./PackageNode");


class RepositoryNode {
  constructor(repo, workspace, context) {
    this.context = context;
    this.slug = repo.slug;
    this.slug_perm = repo.slug_perm;
    this.name = repo.name;
    this.workspace = workspace;
  }

  getTreeItem() {
    const repo = this.name;

    return {
      label: repo,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "repository",
    };
  }

  async getPackages() {
    const cloudsmithAPI = new CloudsmithAPI(this.context);

    let workspace = this.workspace;
    let repo = this.slug;
    const config = vscode.workspace.getConfiguration("cloudsmith");
    const maxPackages = await config.get("showMaxPackages"); // get legacy app setting from configuration settings
    const packages = await cloudsmithAPI.get(
      "packages/" + workspace + "/" + repo + "/?sort=-date&page_size=" + maxPackages
    );

    const PackageNodes = [];
    if (packages) {
      for (const pkg of packages) {
        const packageNode = require("./PackageNode");
        const packageNodeInst = new packageNode(pkg, this.context);
        PackageNodes.push(packageNodeInst);
      }
    }
    return PackageNodes;
  }

  async getChildren() {
    const packages = await this.getPackages();

    if (packages.length > 0) {
			return packages.map(item => {
				return new packageNode(item)
			})
		}
		else {
			return packages.map(item => {
				return new packageNode(item)
			})
		}
  }
}

module.exports = RepositoryNode;
