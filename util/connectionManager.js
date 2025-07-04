const vscode = require('vscode');

// Show input box to enter credential key and store to secret
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

// Fetch credential from secret store
async function getApiKey(context) {
  const apiKey = await context.secrets.get('cloudsmith.authToken');

  if (!apiKey) {
    vscode.window.showWarningMessage('No credentials found. Please ensure to set your Cloudsmith credentials.');
    return null;
  }

  return apiKey;
}


module.exports = {
    storeApiKey,
    getApiKey
}
