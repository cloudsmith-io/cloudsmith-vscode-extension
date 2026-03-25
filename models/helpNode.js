// Help & feedback treeview

const vscode = require('vscode');

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

    getTreeItem() {
        return {
            label: this.label,
            iconPath: this.icon,
            command: this.command,
            tooltip: this.tooltip,
        };
    }

    getChildren() {
        return [];
    }
}

module.exports = helpNode;
