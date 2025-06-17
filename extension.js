const vscode = require('vscode');
const cloudsmithApi = require('./functions/cloudsmith_apis.js');
const path = require('path');
const env = require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Load from .env
const apiKey = env.parsed.CLOUDSMITH_API_KEY;

class MyTreeItem extends vscode.TreeItem {
	constructor(label, collapsibleState = vscode.TreeItemCollapsibleState.None, contextValue = 'item') {
		super(label, collapsibleState);
		this.contextValue = contextValue;
		this.tooltip = `Details about ${label}`;
		this.description = label;
	}
}

class TreeDataProvider {
	constructor(fetchDataFn) {
		this.fetchDataFn = fetchDataFn;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return element;
	}

	async getChildren(element) {
		// Only root level
		if (!element) {
			const data = await this.fetchDataFn();
			return data.map(item => new MyTreeItem(item.name));
		}

		// No children in this example
		return [];
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	
	const myWorkspaces = new TreeDataProvider(() => vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithWorkspaces'));
	const myRepos = new TreeDataProvider(() => vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithReposList'));

	vscode.commands.executeCommand('setContext', 'cloudsmith.authenticated', true);

	vscode.window.createTreeView('myWorkspaces', {
		treeDataProvider: myWorkspaces,
		showCollapseAll: false,
		registerCommand: 
	});

	// Optional: add refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('cloudsmith-vscode-extension.refreshTree', () => {
            myWorkspaces.refresh();
        })
    );

	vscode.window.createTreeView('myRepos', {
		treeDataProvider: new TreeDataProvider(),
		showCollapseAll: false
	});

	vscode.window.createTreeView('myPackages', {
		treeDataProvider: new TreeDataProvider()
	});





	/*********************************************************************
	 *********      ----- WORKSPACE ENDPOINTS -----   *************************
	 *********************************************************************/

	let getWorkspaces = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithWorkspaces',
		async function () {
			// fetch workspaces
			const workspaces = await cloudsmithApi.get('namespaces', apiKey);
			return workspaces
		}
	);

	let showWorkspacesQP = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithWorkspacesQP',
		async function () {

			// fetch workspaces to show in quickpick
			const workspaces = await vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithWorkspaces');
			
			const items = workspaces.map(
				workspace => {
					return {
						label: workspace.name,
						detail: workspace.slug
					}
				})
			const workspace = await vscode.window.showQuickPick(items, {
				placeHolder: "You have access to the following Workspaces",
				matchOnDetail: true,
			})
			if (workspace == null) return
			return workspace
		}
	);



	/*********************************************************************
	 *********      ----- REPO ENDPOINTS -----   *************************
	 *********************************************************************/


	// Fetch Repos
	let getRepos = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposList',
		async function () {
			const repos = await cloudsmithApi.get('repos', apiKey);
			return repos
		}
	);

	let showReposQP = vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithReposListQP',
		async function () {

			const repos = await vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithReposList');
			const items = repos.map(
				repo => {
					return {
						label: repo.namespace + ' | ' + repo.name + ' | ' + '( ' + repo.repository_type_str + ')',
						detail: repo.description,
						link: "https://app.cloudsmith.com/" + repo.namespace + "/" + repo.name
					}
				})

			const repo = await vscode.window.showQuickPick(items, {
				placeHolder: "Your Cloudsmith repositories",
				matchOnDetail: true,
			})
			if (repo == null) return

			vscode.env.openExternal(repo.link) //if user selects a repo it will prompt to open link to it in browser
		}
	);

	let showReposPerWorkspaceQP = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposListNamespace',
		async function () {

			const workspace = await vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithWorkspacesQP');
			const response = await cloudsmithApi.get('repos/' + workspace.detail, apiKey);

			const items2 = response.map(
				repo => {
					return {
						label: repo.namespace + ' | ' + repo.name + ' | ' + '( ' + repo.repository_type_str + ')',
						detail: repo.description,
						link: "https://app.cloudsmith.com/" + repo.namespace + "/" + repo.name
					}
				})

			const repo = await vscode.window.showQuickPick(items2, {
				placeHolder: "Your Cloudsmith repositories",
				matchOnDetail: true,
			})
			if (repo == null) return

			vscode.env.openExternal(repo.link)


		}
	);


	// Creates new json template tab with a json template for end user to configure. 
	let reposCreateTemplate = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposCreateTemplate',
		async function () {

			const jsonData = {
				name: '',
				content_kind: 'Standard',
				copy_packages: 'Read',
				default_privilege: 'None',
				delete_packages: 'Admin',
				manage_entitlements_privilege: 'Admin',
				move_packages: 'Admin',
				replace_packages: 'Write',
				repository_type_str: 'Public',
				resync_packages: 'Admin',
				scan_packages: 'Read',
				storage_region: 'default',
				use_entitlements_privilege: 'Read',
				view_statistics: 'Read'

			};

			const jsonContent = JSON.stringify(jsonData, null, 2);
			const doc = await vscode.workspace.openTextDocument({
				language: 'json',
				content: jsonContent
			});
			await vscode.window.showTextDocument(doc);

		}
	);

	// Create new repo using the open json file
	let reposCreateNew = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposCreateNew',
		async function () {

			// get the json text from the active editor and add to API payload request
			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showErrorMessage('No active text editor found.');
				return;
			}

			const namespaces = await cloudsmithApi.get('namespaces');
			const items = namespaces.map(
				namespace => {
					return {
						label: namespace.name,
						detail: namespace.slug
					}
				})

			const namespace = await vscode.window.showQuickPick(items, {
				placeHolder: "Select a namespace to create the repository on",
				matchOnDetail: true,
			})
			if (namespace == null) return

			const document = editor.document;
			const payload = document.getText();

			const url = 'repos/' + namespace.detail + '/';
			var response = await cloudsmithApi.post(url, payload);

			const message = 'Successfully created the repository called ' + response.name;
			const buttonText = 'Open in Cloudsmith';
			const link = 'https://app.cloudsmith.com/' + response.namespace + '/' + response.name; // Replace with your link

			vscode.window.showInformationMessage(message, buttonText).then(selection => {
				if (selection === buttonText) {
					vscode.env.openExternal(vscode.Uri.parse(link));
				}
			});


		}
	);

	/*********************************************************************
	 *********      ----- MISC REQUESTS -----   *************************
	 *********************************************************************/

	let docs = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithDocs',
		function () {
			vscode.env.openExternal("https://help.cloudsmith.io/docs/welcome-to-cloudsmith-docs")
		}
	);

	context.subscriptions.push(docs, getRepos, showReposQP, reposCreateTemplate, reposCreateNew, showReposPerWorkspaceQP, getWorkspaces, showWorkspacesQP);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}


