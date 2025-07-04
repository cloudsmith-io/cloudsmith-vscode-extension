const vscode = require('vscode');

async function storeApiKey(context) {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Cloudsmith API Key or Service Access Token',
    password: true,
    ignoreFocusOut: true
  });

  if (apiKey) {
    await context.secrets.store('cloudsmith.authToken', apiKey);
    vscode.window.showInformationMessage('Credential saved securely!');
  }
}

module.exports = {
    storeApiKey
}
