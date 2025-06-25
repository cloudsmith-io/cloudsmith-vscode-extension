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

        if(label.includes('Get Started')){
            iconPath = path.join(__filename, '..', '..', 'media', 'logo.svg')
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