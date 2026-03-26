const assert = require("assert");
const vscode = require("vscode");
const { SearchProvider } = require("../views/searchProvider");
const { PaginatedFetch } = require("../util/paginatedFetch");

suite("SearchProvider Test Suite", () => {
  let originalWithProgress;
  let originalShowErrorMessage;
  let originalShowInformationMessage;
  let originalShowWarningMessage;
  let originalGetConfiguration;
  let originalFetchPage;
  let provider;

  const context = {
    secrets: {
      onDidChange() {},
      async get() {
        return "true";
      },
    },
  };

  setup(() => {
    provider = new SearchProvider(context);

    originalWithProgress = vscode.window.withProgress;
    originalShowErrorMessage = vscode.window.showErrorMessage;
    originalShowInformationMessage = vscode.window.showInformationMessage;
    originalShowWarningMessage = vscode.window.showWarningMessage;
    originalGetConfiguration = vscode.workspace.getConfiguration;
    originalFetchPage = PaginatedFetch.prototype.fetchPage;

    vscode.window.withProgress = async (_options, task) => task();
    vscode.window.showErrorMessage = async () => {};
    vscode.window.showInformationMessage = async () => {};
    vscode.window.showWarningMessage = async () => {};
    vscode.workspace.getConfiguration = () => ({
      get() {
        return 50;
      },
    });
    PaginatedFetch.prototype.fetchPage = async () => ({
      data: [{
        name: "artifact",
        format: "raw",
        repository: "repo-a",
        namespace: "workspace-a",
        status_str: "Completed",
        slug: "artifact-1",
        slug_perm: "artifact-1-perm",
        downloads: 0,
        version: "1.0.0",
        uploaded_at: "2026-03-25T00:00:00Z",
      }],
      pagination: {
        page: 1,
        pageTotal: 1,
        count: 1,
      },
    });
  });

  teardown(() => {
    vscode.window.withProgress = originalWithProgress;
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.window.showInformationMessage = originalShowInformationMessage;
    vscode.window.showWarningMessage = originalShowWarningMessage;
    vscode.workspace.getConfiguration = originalGetConfiguration;
    PaginatedFetch.prototype.fetchPage = originalFetchPage;
  });

  test("search() clears repo scope when repo is omitted", async () => {
    provider.currentRepo = "repo-a";
    await provider.search("workspace-a", "vulnerabilities:>0");
    assert.strictEqual(provider.currentRepo, null);
  });

  test("searchRepos() clears stale repo scope", async () => {
    provider.currentRepo = "repo-a";
    await provider.searchRepos("workspace-a", ["repo-a", "repo-b"], "vulnerabilities:>0");
    assert.strictEqual(provider.currentRepo, null);
  });
});
