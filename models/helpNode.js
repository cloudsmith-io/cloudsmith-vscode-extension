const vscode = require('vscode');
const path = require('path');

class helpNode extends vscode.TreeItem {
    constructor(label, url) {
        super(label);
        this.label = label;
        this.url = url;
        this.command = {
            command: 'cloudsmith.openLink',
            title: 'Open Link',
            arguments: [url]
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
            iconPath = new vscode.ThemeIcon('logo-github')
        }
        else {
            iconPath = new vscode.ThemeIcon('info')
        }
        

        return {
            label: label,
            iconPath: iconPath
        }
    }
}

module.exports = helpNode;