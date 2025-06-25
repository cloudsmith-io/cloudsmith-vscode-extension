const vscode = require('vscode');
const path = require('path');
const packageDetailsNode = require('../models/packageDetailsNode')


class PackageNode {
	constructor(pkg) {
			this.pkgDetails = [pkg.slug, pkg.slug_perm, pkg.downloads, pkg.version, pkg.status_str, pkg.tags];
			this.slug = "Slug: " + pkg.slug;
			this.slug_perm = "Slug Perm: " + pkg.slug_perm;
			this.name = pkg.name;
			this.status_str = "Status: " + pkg.status_str;
			this.is_quarantined = pkg.is_quarantined;
			this.downloads = "Downloads: " + pkg.downloads;
			this.version = "Version: " + pkg.version;
			this.format = pkg.format;
			if(pkg.tags.info){
				if(pkg.tags.version){
					this.tags = "Tags: " + [pkg.tags.info, pkg.tags.version];
				}
				else {
					this.tags = "Tags: " + pkg.tags.info;
				}
			}
			else {
				this.tags = "Tag: " + pkg.tags.version;
			};
		
	}

	getTreeItem() {
		let iconPath = ''
		let format = this.format
		let pkg = this.name

		// set package format icon. Using format var as filename so ensure any new icons added match the format naming convention and are svg files
		iconPath = {
				light: path.join(__filename, "..", "..", "media", "formats", "light", format + '.svg'),
				dark: path.join(__filename, "..", "..", "media", "formats", "dark", format + '.svg')
			}

		return {
			label: pkg,
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