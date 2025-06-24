const vscode = require('vscode');

class PackageModel extends vscode.TreeItem {

    constructor(pkg, name) {
		super(name, pkg, vscode.TreeItemCollapsibleState.Collapsed);
		this.slug = "Slug: " + pkg.slug;
		this.slug_perm = "Slug Perm: " + pkg.slug_perm;
		this.name = pkg.name;
		this.status = "Status: " + pkg.status_str;
		this.downloads = "Downloads: " + pkg.downloads;
		this.version = "Version: " + pkg.version;
		this.tagsInfo = "Additional Tags: " + pkg.tags.info;
		this.tagsVersion = "Tag: " + pkg.tags.version;
		this.label = name;

	}
}

module.exports = PackageModel;