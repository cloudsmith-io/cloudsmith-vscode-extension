

const vscode = require('vscode');
const path = require('path');
const PackageModel = require('../models/packageNode');
const PackageDetailsModel = require('../models/PackageDetailsModel');

class PackageProvider {
    constructor(data) {
        this.data = data;
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }

    getTreeItem(element) {
        let iconPath = path.join(__filename, "..", "..", "media", "CloudsmithSymbol--WhiteTransparent@M.svg");
        return {
            label: element,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: iconPath
        };
    }

    async getChildren(element) {
        try {
            const pkg = this.data;
            console.log(pkg);
            if (!element) {
                const data = await this.data();
                return data.map(item => new PackageModel(item, item.name));

            }
            return [
                new PackageDetailsModel(pkg)
                //new PackageDetailsModel(pkg.version),
                //new PackageDetailsModel(pkg.tagsInfo),
                //new PackageDetailsModel(pkg.tagsVersion),
                //new vscode.TreeItem(pkg.status),
                //new vscode.TreeItem(pkg.version)

            ];
        }
        catch (err) {
            console.log(err)
        }
    }
}

module.exports = { PackageProvider };

