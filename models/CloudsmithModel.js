const vscode = require('vscode');

class CloudsmithModel extends vscode.TreeItem {
    constructor(label, collapsibleState = vscode.TreeItemCollapsibleState.None, contextValue = 'item') {
		super(label, collapsibleState);
		this.contextValue = contextValue;
		this.tooltip = `Details about ${label}`;
		this.description = label;
	}
}

module.exports = CloudsmithModel;