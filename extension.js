// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');


/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	// Cloudsmith API Fetch All Repos URL
	const apiReposURL = 'https://api.cloudsmith.io/v1/repos';
	const apiKey = '8759814c39d066a104f9b6c50074cc223b3d1e42';
	var t = '';

	const requestOptions = {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
		},
	};

	const url = "https://api.cloudsmith.io/v1/repos";
	try {
		const response = await fetch(url, requestOptions);
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
				link: repo.self_html_url	
			}
		})

	let reposList = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposList',
		async function () {
			const repo = await vscode.window.showQuickPick(items, {
				placeHolder: "Your Cloudsmith repositories",
				matchOnDetail: true,
			})
			if (repo == null) return
			console.log(repo.link)

			vscode.env.openExternal(repo.link)
		});


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

	let docs = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithDocs', function () {
		vscode.env.openExternal("https://help.cloudsmith.io/docs/welcome-to-cloudsmith-docs")
	});

	context.subscriptions.push(auth, docs, reposList);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
