const vscode = require('vscode');

class PackageDetailsNode {
	constructor(detail, context) {
		this.context = context;
		this.label = detail;
	}

	getTreeItem(element) {
		const treeItem = new vscode.TreeItem(element);
		let iconPath = undefined;
		let detail = this.label
		let id = detail.label.id
		let value = detail.label.value

		if (value === null){
			value = "..."
		}

		if (value instanceof Array){ //check if value is an array (tags.info and tags.version combined)
			value = String(value) //set value to string type
		}
		else {
			detail = this.label.value;
		}

		// handle icon rendering with ThemeIcon
		if (id.toLowerCase().includes("slug")) {
			iconPath = new vscode.ThemeIcon('info');
		}
		if (id.toLowerCase().includes("downloads")) {
			iconPath = new vscode.ThemeIcon('cloud-download');
		}
		if (id.toLowerCase().includes("tags")) {
			iconPath = new vscode.ThemeIcon('tag');
		}
		if (id.toLowerCase().includes("version")) {
			iconPath = new vscode.ThemeIcon('versions');
		}
		if (id.toLowerCase().includes("status")) {
			if (value.includes("Quarantined")) { //if quarantined, flag it
				iconPath = new vscode.ThemeIcon('error');
			}
			else {
				iconPath = new vscode.ThemeIcon('check');
			}
		}

		treeItem.command = {
			command: 'cloudsmith.copySelected',
			title: 'Copy Label',
			arguments: [treeItem]
		}
		

		return {
			
			label: value,
			tooltip: id,
			collapsibleState: vscode.TreeItemCollapsibleState.None, //no children to show so this cannot be extended
			contextValue: "packageDetail",
			iconPath: iconPath,

		}
	}

	getChildren() {
		return []
	}

}

module.exports = PackageDetailsNode;