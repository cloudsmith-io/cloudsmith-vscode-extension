const vscode = require('vscode');
const path = require('path');
const repositoryNode = require("./RepositoryNode");
const cloudsmithApi = require('../util/cloudsmithAPI');
const env = require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load from .env
const apiKey = env.parsed.CLOUDSMITH_API_KEY;

class WorkspaceNode {
	constructor(item) {
		this.name = item.name;
		this.slug = item.slug;
		this.repos = [];
	}

	getTreeItem() {
		const workspace = this.name
		let iconPath = {
			light: path.join(__filename, "..", "..", "media", "workspace_light.svg"),
			dark: path.join(__filename, "..", "..", "media", "workspace_dark.svg")
		}
		return {
			label: workspace,
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: "workspace",
			iconPath: iconPath
		}
	}

	async getRepositories() {
		const workspace = this.slug
		const repositories = await cloudsmithApi.get('repos/' + workspace + '/?sort=name', apiKey);
		const RepositoryNodes = []
		if (repositories) {
			for (const id of repositories) {
				const repositoryNode = require('../models/RepositoryNode')
				const repositoryNodeInst = new repositoryNode(id, this.name)
				RepositoryNodes.push(repositoryNodeInst)
			}
		}
		return RepositoryNodes
	}

	async getChildren() {
		const repos = await this.getRepositories()

		return repos.map(item => {
			return new repositoryNode(item, this.slug)
		})
	}

}

module.exports = WorkspaceNode;