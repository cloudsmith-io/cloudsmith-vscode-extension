const vscode = require('vscode');
const path = require('path');
//const packageDetailsNode = require("./PackageDetailsNode");

class PackageDetailsNode {
	constructor(detail) {
		;
		this.label = detail;
	}

	getTreeItem() {
		let iconPath = ''
		let detail = this.label
		const text = detail.label

		if (text.includes("Slug")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "info.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "info.svg"),
			}
		}
		if (text.includes("Downloads")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "downloads.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "downloads.svg"),
			}
		}
		if (text.includes("Tag")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "tags.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "tags.svg"),
			}
		}
		if (text.includes("Version")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "version.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "version.svg"),
			}
		}
		if (text.includes("Status")) {
			if (text.includes("Quarantined")) {
				iconPath = {
					light: path.join(__filename, "..", "..", "media", "misc", "nope.svg"),
					dark: path.join(__filename, "..", "..", "media", "misc", "nope.svg"),
				}
			}
			else {
				iconPath = {
					light: path.join(__filename, "..", "..", "media", "misc", "good.svg"),
					dark: path.join(__filename, "..", "..", "media", "misc", "good.svg"),
				}
			}

		}


		return {
			label: detail,
			collapsibleState: vscode.TreeItemCollapsibleState.None, //no children to show so this cannot be extended
			contextValue: "packageDetail",
			iconPath: iconPath
		}
	}

	getChildren() {
		return []
	}



}

module.exports = PackageDetailsNode;