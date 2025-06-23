const vscode = require('vscode');

class RepoModel extends vscode.TreeItem {
    constructor(name, repo, collapsibleState = vscode.TreeItemCollapsibleState.None) {
		super(repo, collapsibleState);
		this.tooltip = `Name: ${repo.name}`;
		this.type = repo.type_name;
		this.slug = repo.slug;
		this.slug_perm = repo.slug_perm;
		this.name = repo.name;
		this.label = name;

	}
}

module.exports = RepoModel;