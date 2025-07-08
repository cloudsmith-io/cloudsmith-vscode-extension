// This class handles the connection to Cloudsmith.

const vscode = require("vscode");
const { CredentialManager } = require("./credentialManager");

class ConnectionManager {
  constructor(context) {
    this.context = context;
  }

  // Check response to API for authentication - basic workflow for now
  async checkConnectivity(apiKey) {
    const { CloudsmithAPI } = require("./cloudsmithAPI");
    let checkPassed = false;
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const userAuthenticated = await cloudsmithAPI.get("user/self", apiKey);

    if (!userAuthenticated.authenticated) {
      checkPassed = false;
    } else {
      checkPassed = true;
    }

    return checkPassed;
  }

  async isConnected() {

    const isConnected = await this.context.secrets.get("cloudsmith.isConnected");

    return isConnected

  }

  // Connect to Cloudsmith
  async connect() {
    const context = this.context;
    let connectionStatus = this.isConnected();

    const credentialManager = new CredentialManager(context);
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
      connectionStatus = await this.checkConnectivity(apiKey);
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
        context.secrets.store("isConnected", connectionStatus);
      }
    }

    return connectionStatus;
  }
}

module.exports = { ConnectionManager };
