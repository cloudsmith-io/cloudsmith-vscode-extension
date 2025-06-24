const vscode = require('vscode');
const path = require('path');
const packageNode = require("./PackageNode");

class RepositoryNode{
    constructor(repo) {
		this.slug = repo.slug;
		this.slug_perm = repo.slug_perm;
		this.name = repo.name;
		this.packages = [];
	}

	getTreeItem() {
		let iconPath = ''
		iconPath = path.join(__filename, "..", "..", "media", "repo.svg")

		return {
			label: this.name,
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: "repository",
			iconPath: iconPath,
		}
	}

	async getChildren() {
		return []
	}

}

module.exports = RepositoryNode;