const vscode = require('vscode');
const path = require('path');
const packageDetailsNode = require('../models/packageDetailsNode')


class PackageNode {
	constructor(pkg) {
			this.pkgDetails = [pkg.status_str, pkg.slug, pkg.slug_perm, pkg.downloads, pkg.version, pkg.tags ];
			this.slug = {"id": "Slug", "value": pkg.slug};
			this.slug_perm = {"id": "Slug Perm", "value": pkg.slug_perm};
			this.name = pkg.name;
			this.status_str = {"id": "Status", "value": pkg.status_str};
			this.downloads = {"id": "Downloads", "value": String(pkg.downloads)};
			this.version = {"id": "Version", "value": pkg.version};
			this.format = pkg.format;
			if(pkg.tags.info){ // handle tags since we split tags between tags.info and tags.version as both may not coexist at the same time
				if(pkg.tags.version){
					this.tags = {"id": "Tags", "value": String([pkg.tags.info, pkg.tags.version])}; //combine tags sources
				}
				else {
					this.tags = {"id": "Tags", "value": pkg.tags.info};
				}
			}
			else {
				if(pkg.tags.version){
					this.tags = {"id": "Tags", "value": pkg.tags.version};
				}
				else {
					this.tags = {"id": "Tags", "value": ""};
				}
			};
	}

	getTreeItem() {
		let iconPath = ''
		let format = this.format
		let pkg = this.name

		// set package format icon. Using the format value as filename so ensure any new icons added match the format naming convention and are svg files. No need to hardcode logic for each type :) 
		/*
		iconPath = {
				light: path.join(__filename, "..", "..", "media", "formats", "light", format + '.svg'),
				dark: path.join(__filename, "..", "..", "media", "formats", "dark", format + '.svg')
			}
		*/

		const iconURI = 'file_type_' + format + '.svg'
		iconPath = path.join(__filename, "..", "..", "media", "vscode_icons", iconURI)
		

		

		return {
			label: pkg,
			tooltip: format,
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: "package",
			iconPath: iconPath
		}
	}

	async getPackageDetails() {
		let pkgDetails = this.pkgDetails
		const PackageDetailsNodes = []
		if (pkgDetails) {
			for (const id of pkgDetails){
				const packageDetailsNode = require("./PackageDetailsNode");
				const packageDetailsNodeInst = new packageDetailsNode(id)
				PackageDetailsNodes.push(packageDetailsNodeInst)
			}
		}
		return PackageDetailsNodes
	}

	async getChildren() {

		const pkgDetails = await this.getPackageDetails()

		return pkgDetails.map(item => {
			return new packageDetailsNode(item)
		})
	}



}

module.exports = PackageNode;