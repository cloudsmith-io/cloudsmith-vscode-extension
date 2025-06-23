const vscode = require('vscode');

class PackageDetailsModel extends vscode.TreeItem {

    constructor(pkg) {
		super(pkg, vscode.TreeItemCollapsibleState.None);
		this.slug = pkg.slug;
		this.slug_perm = pkg.slug_perm;
		this.status = pkg.status_str;
		this.label = pkg
	}
}

module.exports = PackageDetailsModel;