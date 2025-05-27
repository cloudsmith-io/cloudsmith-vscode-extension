// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const apiKey = '8759814c39d066a104f9b6c50074cc223b3d1e42';

const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {



	/**
	 * REPO ENDPOINTS
	 */

	// Fetch Repos
	let reposList = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposList',
		async function () {

			const apiReposURL = 'https://api.cloudsmith.io/v1/repos';	
			var t = '';

			const requestOptions = {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
				},
			};

			try {
				const response = await fetch(apiReposURL, requestOptions);
				if (!response.ok) {
				throw new Error(`Response status: ${response.status}`);
				}
				t = await response.json();
			} catch (error) {
				console.error(error.message);
			}
			// Map the json objects to be used by extensions QuickPick
			const items = t.map(
				repo => {
					return {
						label: repo.name + '(' + repo.repository_type_str + ')',
						detail: repo.namespace,	
						link: "https://app.cloudsmith.com/" + repo.namespace + "/" + repo.name
					}
				})

			const repo = await vscode.window.showQuickPick(items, {
				placeHolder: "Your Cloudsmith repositories",
				matchOnDetail: true,
			})
			if (repo == null) return
			console.log(repo.link)

			vscode.env.openExternal(repo.link)
		});

	// Creates new template file with json template for user to submit. 
	let reposCreateTemplate = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposCreateTemplate', 
		async function () {

			const jsonData = {
			name: "REPO_NAME",
			description: "REPO_DESCRIPTION",
			repository_type_str: "Private",
			slug: "REPO_SLUG"
			};

			const jsonContent = JSON.stringify(jsonData, null, 2);

			const doc = await vscode.workspace.openTextDocument({
				language: 'json',
				content: jsonContent
			});

			await vscode.window.showTextDocument(doc);

	});

	// Create new repo using the open json file
	let reposCreateNew = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposCreateNew', 
		async function () {

			// get the json text from the active editor and add to API payload request
			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showErrorMessage('No active text editor found.');
				return;
			}

			const document = editor.document;
			const text = document.getText();

			// You can log it, parse it, or use it however you need
			console.log('Payload:', text);



	});



	// THIS IS NOT REALLY NEEDED NOW IF WE USE API REQUESTS RATHER THAN A LOCAL CLI DEPLOYMENT. 
	let auth = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithAuth', function () {
		exec('cloudsmith auth -o cloudsmith', (err, stdout, stderr) => {
			if (err) {
				vscode.window.showInformationMessage('Failed to run command:', stderr);
				return;
			}
			// the *entire* stdout and stderr (buffered)
			console.log(`stdout: ${stdout}`);
			console.log(`stderr: ${stderr}`);
		});
	});

	/**
	 * MISC REQUESTS
	 */

	let docs = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithDocs', function () {
		vscode.env.openExternal("https://help.cloudsmith.io/docs/welcome-to-cloudsmith-docs")
	});

	context.subscriptions.push(auth, docs, reposList, reposCreateTemplate, reposCreateNew);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
