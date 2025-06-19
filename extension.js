const vscode = require('vscode');
const { ViewProvider } = require('./views/viewProvider');
const { RepoProvider } = require('./views/reposProvider');
const { PackageProvider } = require('./views/packagesProvider');
const cloudsmithApi = require('./functions/cloudsmith_apis.js');
const path = require('path');
const env = require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Load from .env
const apiKey = env.parsed.CLOUDSMITH_API_KEY;

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	vscode.commands.executeCommand('setContext', 'cloudsmith.authenticated', true);

	let getWorkspaces = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithWorkspaces',
		async function () {
			// fetch workspaces
			const workspaces = await cloudsmithApi.get('namespaces', apiKey);
			//return workspaces
			return workspaces;
		}
	);

	const workspacesProvider = new ViewProvider(() => vscode.commands.executeCommand('cloudsmith-vscode-extension.cloudsmithWorkspaces'));

	vscode.window.createTreeView('workspacesView', {
		treeDataProvider: workspacesProvider,
		showCollapseAll: false
	});



	vscode.commands.registerCommand('cloudsmith-vscode-extension.selectWorkspace', async (item) => {

		const data = await cloudsmithApi.get('repos/' + item.label, apiKey);
		const reposProvider = new RepoProvider(() => data); //this needs to point to a separate provider for repos which has selectRepo command associated. 

		vscode.window.createTreeView('reposView', {
			treeDataProvider: reposProvider,
			showCollapseAll: false
		});

	});

	vscode.commands.registerCommand('cloudsmith-vscode-extension.selectRepo', async (item) => {

		const data = await cloudsmithApi.get('packages/colinmoynes-test-org/' + item.label + '/?sort=-date',  apiKey);
		const packageProvider = new PackageProvider(() => data); //this needs to point to a separate provider for repos which has selectRepo command associated. 

		vscode.window.createTreeView('packagesView', {
			treeDataProvider: packageProvider,
			showCollapseAll: false
		});

	});







	/*********************************************************************
	 *********      ----- WORKSPACE ENDPOINTS -----   *************************
	 *********************************************************************/



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

	let showReposQP = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposListQP',
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

	let showReposPerWorkspaceQP = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposListWorkspaceQP',
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


