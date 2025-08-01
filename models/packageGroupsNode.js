// Package Groupde node treeview

const vscode = require("vscode");
const packageDetailsNode = require("./packageDetailsNode");

class PackageGroupsNode {
  constructor(pkg, context) {
    this.context = context;
    this.pkgDetails = [
      pkg.count,
      pkg.size,
      pkg.num_downloads,
      pkg.last_push
    ];
    this.num_downloads = { id: "Downloads", value: String(pkg.num_downloads) };
	  this.last_push = { id: "Last Pushed", value: pkg.last_push };
    this.count = { id: "Count", value: String(pkg.count) };
    this.size = { id: "Size", value: String(pkg.size) };
    this.name = pkg.name;
    this.repo = pkg.repo;
    this.workspace = pkg.workspace;
    
  }

  getTreeItem() {
    let iconPath = new vscode.ThemeIcon('package');
    let pkg = this.name;

    return {
      label: pkg,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "packageGroup",
      iconPath: iconPath,
    };
  }

  async getPackageDetails() {
    let pkgDetails = this.pkgDetails;
    const PackageDetailsNodes = [];
    if (pkgDetails) {
      for (const id of pkgDetails) {
        const packageDetailsNode = require("./PackageDetailsNode");
        const packageDetailsNodeInst = new packageDetailsNode(id, this.context);
        PackageDetailsNodes.push(packageDetailsNodeInst);
      }
    }
    return PackageDetailsNodes;
  }

  async getChildren() {
    
	const pkgDetails = await this.getPackageDetails();

    return pkgDetails.map((item) => {
      return new packageDetailsNode(item);
    });
	
  }
}

module.exports = PackageGroupsNode;
