const vscode = require('vscode');
const path = require('path');
const packageNode = require("./PackageNode");
const cloudsmithApi = require('../util/cloudsmithAPI');
const env = require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load from .env
const apiKey = env.parsed.CLOUDSMITH_API_KEY;

class RepositoryNode {
	constructor(repo, workspace) {
		this.slug = repo.slug;
		this.slug_perm = repo.slug_perm;
		this.name = repo.name;
		this.workspace = workspace;
	}

	getTreeItem() {
		const repo = this.name

		return {
			label: repo,
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: "repository",
		}
	}

	async getPackages() {
		let workspace = this.workspace
		let repo = this.slug
		const packages = await cloudsmithApi.get('packages/' + workspace + '/' + repo + '/?sort=name', apiKey);
		const PackageNodes = []
		if (packages) {
			for (const id of packages) {
				const packageNode = require('./PackageNode')
				const packageNodeInst = new packageNode(id)
				PackageNodes.push(packageNodeInst)
			}
		}
		return PackageNodes
	}

	async getChildren() {
		const packages = await this.getPackages()

		if (packages.length > 0) {
			return packages.map(item => {
				return new packageNode(item)
			})
		}
		else {
			return packages.map(item => {
				return new packageNode(item)
			})
		}



	}

}

module.exports = RepositoryNode;