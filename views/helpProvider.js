const vscode = require('vscode');
const path = require('path');

class helpProvider {
    constructor(fetchDataFn) {
        this.fetchDataFn = fetchDataFn;
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    getTreeItem(element) {
        let iconPath = path.join(__filename, "..", "..", "media", "icon.svg");
        return {
            label: element,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: iconPath
        };
    }

    getChildren() {
        return []    
    }

}

module.exports = { helpProvider };






/*

getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element);
        treeItem.tooltip = element.tooltip;
        return treeItem;
    }


    async getChildren(element) {
        // Only root level
        if (!element) {
            console.log("getChildren called with ", element);
            const data = await this.fetchDataFn();
            return data.map(item => new PackageModel(item, item.name));
        }
        let items = this.getTreeItem(element);
        // Show child fields as TreeItems
        return {
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                items
        };

    }
        */