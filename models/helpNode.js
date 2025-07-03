const vscode = require('vscode');
const path = require('path');

class helpNode extends vscode.TreeItem {
    constructor(label, url) {
        super(label);
        this.tooltip = url;
        this.description = url;
        this.label = label;
        this.url = url;
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
        let iconPath = ''

        if (label.includes('Get Started')) {
            iconPath = {
                light: path.join(__filename, "..", "..", "media", "workspace_light.svg"),
                dark: path.join(__filename, "..", "..", "media", "workspace_dark.svg")
            }
        }
        else if (label.includes('Issue')) {
            iconPath = {
                light: path.join(__filename, '..', '..', 'media', 'misc', 'light', 'github.svg'),
                dark: path.join(__filename, '..', '..', 'media', 'misc', 'dark', 'github.svg')
            }
        }
        else {
            iconPath = new vscode.ThemeIcon('link-external');
        }

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