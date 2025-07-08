const vscode = require("vscode");
const { CredentialManager } = require('./credentialManager');


// Check response to API for authentication - basic workflow for now
async function checkConnectivity(context, apiKey) {
  const { CloudsmithAPI } = require('./cloudsmithAPI');
  let checkPassed = false;
  const cloudsmithAPI = new CloudsmithAPI(context);
  const userAuthenticated = await cloudsmithAPI.get("user/self", apiKey);
  
  if (!userAuthenticated.authenticated) {
    checkPassed = false;
  } else {
    checkPassed = true;
  }

  return checkPassed;
}

// Connect to Cloudsmith
async function connect(context) {
  let connectionStatus = false;
  const credentialManager = new CredentialManager(context)
  const apiKey = await credentialManager.getApiKey();

  checkCreds: if (!apiKey) {
    vscode.window
      .showWarningMessage("No credentials configured!", "Configure", "Cancel")
      .then((selection) => {
        select: if (selection === "Configure") {
          vscode.commands.executeCommand("cloudsmith.configureCredentials");
          break select;
        }
      });
    break checkCreds;
  } else {
    connectionStatus = await checkConnectivity(context, apiKey);
    if (!connectionStatus) {
      vscode.window
        .showErrorMessage(
          "Unable to connect Cloudsmith! Ensure your credentials are correct.",
          "Configure",
          "Cancel"
        )
        .then((selection) => {
          select: if (selection === "Configure") {
            vscode.commands.executeCommand("cloudsmith.configureCredentials");
            break select;
          }
        });
    } else {
      
      vscode.window.showInformationMessage("Connected to Cloudsmith!");
    }
  }
  
  return connectionStatus;
}

module.exports = {
  checkConnectivity,
  connect
};
