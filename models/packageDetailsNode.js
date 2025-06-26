const vscode = require('vscode');
const path = require('path');
//const packageDetailsNode = require("./PackageDetailsNode");

class PackageDetailsNode {
	constructor(detail) {
		this.label = detail;
	}

	getTreeItem() {
		let iconPath = ''
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

		// handle icon rendering
		if (id.includes("slug")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "info.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "info.svg"),
			}
		}
		if (id.includes("downloads")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "downloads.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "downloads.svg"),
			}
		}
		if (id.includes("tags")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "tags.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "tags.svg"),
			}
		}
		if (id.includes("version")) {
			iconPath = {
				light: path.join(__filename, "..", "..", "media", "misc", "version.svg"),
				dark: path.join(__filename, "..", "..", "media", "misc", "version.svg"),
			}
		}
		if (id.includes("status")) {
			if (value.includes("Quarantined")) { //if quarantined, flag it
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
			label: value,
			tooltip: id,
			collapsibleState: vscode.TreeItemCollapsibleState.None, //no children to show so this cannot be extended
			conidValue: "packageDetail",
			iconPath: iconPath,
			
		}
	}

	getChildren() {
		return []
	}

}

module.exports = PackageDetailsNode;