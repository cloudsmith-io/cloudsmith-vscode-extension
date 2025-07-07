const vscode = require("vscode");



// Show input box to enter credential key and store to secret
async function storeApiKey(context) {
  const apiKey = await vscode.window.showInputBox({
    prompt: "Enter your Cloudsmith API Key or Service Access Token",
    password: true,
    ignoreFocusOut: true,
  });

  if (apiKey) {
    await context.secrets.store("cloudsmith.authToken", apiKey);
    vscode.window.showInformationMessage("Credential saved securely!");
  }
}

// Fetch credential from secret store
async function getApiKey(context) {
  const apiKey = await context.secrets.get("cloudsmith.authToken");

  if (!apiKey) {
    return null;
  }

  return apiKey;
}

async function clearCredentials(context) {
  const apiKey = await context.secrets.get("cloudsmith.authToken");

  if (apiKey) {
    vscode.window
      .showWarningMessage(
        "Are you sure you want to delete the stored API key?",
        { modal: true },
        "Delete"
      )
      .then(async (selection) => {
        if (selection === "Delete") {
          await context.secrets.delete("cloudsmith.authToken");
          vscode.window.showInformationMessage("Credentials cleared.");
        }
      });
  } else {
    vscode.window.showWarningMessage("No credentials found.");
  }
}

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
  const apiKey = await getApiKey(context);

  checkCreds: if (!apiKey) {
    vscode.window
      .showWarningMessage("No credentials configured!", "Configure")
      .then((selection) => {
        select: if (selection === "Configure") {
          vscode.commands.executeCommand("cloudsmith.configureCredentials");
          break select;
        }
      });
    break checkCreds;
  } else {
    connectionStatus = await checkConnectivity(context, apiKey);
    //console.log("Connection Status:", connectionStatus)
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
  storeApiKey,
  getApiKey,
  checkConnectivity,
  clearCredentials,
  connect
};
