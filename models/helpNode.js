const vscode = require('vscode');
const path = require('path');

class helpNode extends vscode.TreeItem {
    constructor(label, url, icon) {
        super(label);
        this.tooltip = url;
        this.label = label;
        this.url = url;
        this.icon = icon;
        // Set the command so clicking opens the URL
        this.command = {
            command: 'vscode.open',
            title: 'Open Link',
            arguments: [vscode.Uri.parse(url)]
        };
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element)
        const label = this.label
        const description = this.description
        let iconPath = this.icon

        // Set the command on the tree item as well (for compatibility)
        treeItem.command = this.command;

        return {
            label: label,
            iconPath: iconPath,
            command: this.command
        }
    }
}

module.exports = helpNode;