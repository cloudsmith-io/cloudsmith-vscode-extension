const vscode = require('vscode');
const path = require('path');

class helpNode extends vscode.TreeItem {
    constructor(label, url) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.tooltip = url;
        this.description = url;
        this.command = {
            command: 'vscode.open',
            title: 'Open Website',
            arguments: [vscode.Uri.parse(url)]
        };
    }

    getTreeItem() {
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
            iconPath = new vscode.ThemeIcon('globe');
        }

        return {
            label: label,
            iconPath: iconPath
        }
    }
}

module.exports = helpNode;