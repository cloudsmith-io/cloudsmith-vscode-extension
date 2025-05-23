// The module 'vscode' contains the VS Code extensibility API


// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const exec = require('child_process').exec;


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	const repos = exec('cloudsmith repos list -F pretty_json ', (err, stdout) => {
		if (err) {
			vscode.window.showInformationMessage('Failed to query repositories.');
			return;
		}
		else {
			const data = JSON.parse(stdout)
			console.log(res)
			const res = data.map(
				repo => {
					return {
						label: repo.data.name,
						detail: repo.data.cdn_url,
					}
				}
			)
			return data
		}
	})

	let reposList = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithReposList',
		async function () {
			const repo = await vscode.window.showQuickPick(repos, {
				matchOnDetail: true
			})
			console.log(repos)
		});


	let auth = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithAuth', function () {
		// The code you place here will be executed every time your command is executed
		exec('cloudsmith auth -o cloudsmith', (err, stdout, stderr) => {
			if (err) {
				vscode.window.showInformationMessage('Failed to run command:', stderr);
				return;
			}
			// the *entire* stdout and stderr (buffered)
			console.log(`stdout: ${stdout}`);
			console.log(`stderr: ${stderr}`);
		});
		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello from Cloudsmith!');
	});

	let docs = vscode.commands.registerCommand('cloudsmith-vscode-extension.cloudsmithDocs', function () {
		// The code you place here will be executed every time your command is executed

		vscode.env.openExternal("https://help.cloudsmith.io/docs/welcome-to-cloudsmith-docs")

		// Display a message box to the user
		vscode.window.showInformationMessage('Opening the Cloudsmith Docs website in your browser!');
	});

	context.subscriptions.push(auth, docs, reposList);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
