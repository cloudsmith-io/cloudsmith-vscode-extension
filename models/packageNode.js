// Package node treeview

const vscode = require("vscode");
const path = require("path");
const packageDetailsNode = require("./packageDetailsNode");

class PackageNode {
  constructor(pkg, context) {
    this.context = context;
    this.pkgDetails = [
      pkg.status_str,
      pkg.slug,
      pkg.slug_perm,
      pkg.downloads,
      pkg.version,
      pkg.tags,
	    pkg.uploaded_at
    ];
    this.slug = { id: "Slug", value: pkg.slug };
    this.slug_perm = { id: "Slug Perm", value: pkg.slug_perm };
    this.name = pkg.name;
    this.status_str = { id: "Status", value: pkg.status_str };
    this.downloads = { id: "Downloads", value: String(pkg.downloads) };
    this.version = { id: "Version", value: pkg.version };
    this.format = pkg.format;
	  this.uploaded_at = { id: "Uploaded At", value: pkg.uploaded_at };
    this.repository = pkg.repository;
    this.namespace = pkg.namespace;
    if (pkg.tags.info) {
      // handle tags since we split tags between tags.info and tags.version as both may not coexist at the same time
      if (pkg.tags.version) {
        this.tags = {
          id: "Tags",
          value: String([pkg.tags.info, pkg.tags.version]),
        }; //combine tags sources
      } else {
        this.tags = { id: "Tags", value: pkg.tags.info };
      }
    } else {
      if (pkg.tags.version) {
        this.tags = { id: "Tags", value: pkg.tags.version };
      } else {
        this.tags = { id: "Tags", value: "" };
      }
    }
  }

  getTreeItem() {
    let iconPath = "";
    let format = this.format;
    let pkg = this.name;
    let iconURI = "file_type_" + format + ".svg";

    if (format === "raw") {
      iconPath = new vscode.ThemeIcon("file-binary");
    } else {
      iconPath = path.join(
        __filename,
        "..",
        "..",
        "media",
        "vscode_icons",
        iconURI
      );
    }

    return {
      label: pkg,
      tooltip: format,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "package",
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

module.exports = PackageNode;
