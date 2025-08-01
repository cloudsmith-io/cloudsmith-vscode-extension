// Repo node treeview

const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const packageNode = require("./PackageNode");
const packageGroupsNode = require("./PackageGroupsNode");


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
    let packages = '';
    

    let workspace = this.workspace;
    let repo = this.slug;
    let groupContext = { "repo": repo, "workspace": workspace  };

    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const maxPackages = await config.get("showMaxPackages"); // get legacy app setting from configuration settings
    const groupByPackageGroup = await config.get("groupByPackageGroups");

    if (!groupByPackageGroup) {
      packages = await cloudsmithAPI.get(
        "packages/" + workspace + "/" + repo + "/?sort=-date&page_size=" + maxPackages
      );
    } else {
      const groups = await cloudsmithAPI.get(
        "packages/" + workspace + "/" + repo + "/groups/?sort=-last_push&page_size=" + maxPackages
      );
      packages = groups.results

    }

    const PackageNodes = [];
    if (packages) {
      for (const pkg of packages) {
        if (!groupByPackageGroup) {
          const packageNode = require("./PackageNode");
          let packageNodeInst = new packageNode(pkg, this.context);
          PackageNodes.push(packageNodeInst);
        } else {
          const packageGroupsNode = require("./PackageGroupsNode");
          Object.assign(pkg, groupContext);
          const packageGroupNodeInst = new packageGroupsNode(pkg, groupContext, this.context);
          PackageNodes.push(packageGroupNodeInst);
        }
      }
    }
    return PackageNodes;
  }

  async getChildren() {
    const packages = await this.getPackages();
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const groupByPackageGroup = await config.get("groupByPackageGroups");

    if (packages.length > 0) {
      return packages.map(item => {
        if (!groupByPackageGroup) {
          return new packageNode(item)
        } else {
          return new packageGroupsNode(item)
        }
      })
    }
  }
}

module.exports = RepositoryNode;
