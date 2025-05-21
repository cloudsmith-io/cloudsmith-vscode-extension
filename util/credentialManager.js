// This class handles credential storage and retrieval. 

const vscode = require("vscode");

class CredentialManager {
  constructor(context) {
    this.context = context;
  }

  // Show input box to enter credential key and store as a secret
  async storeApiKey() {
    const context = this.context;
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter your Cloudsmith API Key or Service Access Token",
      password: true,
      ignoreFocusOut: true,
    });

    if (apiKey) {
      await context.secrets.store("cloudsmith-vsc.authToken", apiKey);
      vscode.window.showInformationMessage("Credential saved securely!");
    }
  }

  // Fetch credential from secret store
  async getApiKey() {
    const context = this.context;
    const apiKey = await context.secrets.get("cloudsmith-vsc.authToken");

    if (!apiKey) {
      return null;
    }

    return apiKey;
  }

  // Clear secret
  async clearCredentials() {
    const context = this.context;
    const apiKey = await context.secrets.get("cloudsmith-vsc.authToken");

    if (apiKey) {
      vscode.window
        .showWarningMessage(
          "Are you sure you want to delete the stored API key?",
          { modal: true },
          "Delete"
        )
        .then(async (selection) => {
          if (selection === "Delete") {
            await context.secrets.delete("cloudsmith-vsc.authToken");
            vscode.window.showInformationMessage("Credentials cleared.");
          }
        });
    } else {
      vscode.window.showWarningMessage("No credentials found.");
    }
  }
}

module.exports = { CredentialManager };
