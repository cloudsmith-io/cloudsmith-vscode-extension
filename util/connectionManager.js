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
    let checkPassed = "false";
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const userAuthenticated = await cloudsmithAPI.get("user/self", apiKey);

    if (!userAuthenticated.authenticated) {
      if (userAuthenticated.authenticated === undefined){
        checkPassed = "error";
      } else {
        checkPassed = "false";
      }
      await this.context.secrets.store("cloudsmith.isConnected", checkPassed);
    } else {
      checkPassed = "true";
      await this.context.secrets.store("cloudsmith.isConnected", checkPassed);
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
    let showConnectMsg = true; // contorl whether to show connected notification. Used for refresh.
    let currentConnectionStatus = await this.isConnected();
    let connectionStatus = "";

    const credentialManager = new CredentialManager(context);
    const apiKey = await credentialManager.getApiKey();

    checkCreds: if (!apiKey) {
      connectionStatus = "false";
      vscode.window
        .showWarningMessage("No credentials configured!", "Configure", "Cancel")
        .then((selection) => {
          select: if (selection === "Configure") {
            vscode.commands.executeCommand("cloudsmith.configureCredentials");
            break select;
          }
        });
      return connectionStatus;
    } else {
      let connectionStatus = await this.checkConnectivity(apiKey);

      if (currentConnectionStatus === connectionStatus) { //if current = new status, no need to show notification
        showConnectMsg = false;
      }

      if (connectionStatus === "false" || connectionStatus === "error") {
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
          return connectionStatus;
      } else { // connection status = true
        if (showConnectMsg) {
          vscode.window.showInformationMessage("Connected to Cloudsmith!");
        }
        context.secrets.store("isConnected", connectionStatus);
      }
      return connectionStatus;
    }
    
    
  }
}

module.exports = { ConnectionManager };
