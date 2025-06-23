const vscode = require('vscode');

class WorkspaceModel extends vscode.TreeItem {
    constructor(name, workspace, collapsibleState = vscode.TreeItemCollapsibleState.None) {
		super(workspace, collapsibleState);
		this.tooltip = `Name: ${workspace.name}`;
		this.type = workspace.type_name;
		this.slug = workspace.slug;
		this.slug_perm = workspace.slug_perm;
		this.name = workspace.name;
		this.label = name;

	}
}

module.exports = WorkspaceModel;