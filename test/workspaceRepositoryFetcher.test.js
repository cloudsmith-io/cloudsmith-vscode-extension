const assert = require("assert");
const vscode = require("vscode");
const { PaginatedFetch } = require("../util/paginatedFetch");
const workspaceRepositoryFetcher = require("../util/workspaceRepositoryFetcher");

suite("WorkspaceRepositoryFetcher Test Suite", () => {
  let originalWithProgress;
  let originalFetchPage;
  let originalWarn;
  let progressOptions;
  let progressReports;

  setup(() => {
    originalWithProgress = vscode.window.withProgress;
    originalFetchPage = PaginatedFetch.prototype.fetchPage;
    originalWarn = console.warn;
    progressOptions = null;
    progressReports = [];

    vscode.window.withProgress = async (options, task) => {
      progressOptions = options;
      progressReports = [];
      return task({
        report(update) {
          progressReports.push(update);
        },
      });
    };
  });

  teardown(() => {
    vscode.window.withProgress = originalWithProgress;
    PaginatedFetch.prototype.fetchPage = originalFetchPage;
    console.warn = originalWarn;
  });

  function buildRepositories(start, end) {
    const repositories = [];

    for (let index = start; index >= end; index -= 1) {
      const suffix = String(index).padStart(3, "0");
      repositories.push({
        name: `repo-${suffix}`,
        slug: `repo-${suffix}`,
      });
    }

    return repositories;
  }

  test("fetches and sorts repositories across multiple pages", async () => {
    const calls = [];
    const firstPageData = buildRepositories(500, 1);

    PaginatedFetch.prototype.fetchPage = async (endpoint, page, pageSize) => {
      calls.push({ endpoint, page, pageSize });

      if (page === 1) {
        return {
          data: firstPageData,
          pagination: { page: 1, pageTotal: 2, count: 501, pageSize },
        };
      }

      return {
        data: [{ name: "repo-000", slug: "repo-000" }],
        pagination: { page: 2, pageTotal: 2, count: 501, pageSize },
      };
    };

    const result = await workspaceRepositoryFetcher.fetchWorkspaceRepositories(
      {},
      "workspace-a"
    );

    assert.strictEqual(progressOptions.title, "Loading repositories for workspace-a...");
    assert.deepStrictEqual(
      progressReports.map(report => report.message),
      ["Page 1", "Page 2 of 2"]
    );
    assert.deepStrictEqual(
      calls,
      [
        { endpoint: "repos/workspace-a/?sort=name", page: 1, pageSize: 500 },
        { endpoint: "repos/workspace-a/?sort=name", page: 2, pageSize: 500 },
      ]
    );
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.partial, false);
    assert.strictEqual(result.repositories.length, 501);
    assert.strictEqual(result.repositories[0].name, "repo-000");
    assert.strictEqual(result.repositories[1].name, "repo-001");
    assert.strictEqual(result.repositories[500].name, "repo-500");
  });

  test("returns an error when the first page fails", async () => {
    PaginatedFetch.prototype.fetchPage = async () => ({
      data: [],
      pagination: { page: 1, pageTotal: 1, count: 0, pageSize: 500 },
      error: "Response status: 500",
    });

    const result = await workspaceRepositoryFetcher.fetchWorkspaceRepositories(
      {},
      "workspace-a"
    );

    assert.strictEqual(result.error, "Response status: 500");
    assert.strictEqual(result.partial, false);
    assert.deepStrictEqual(result.repositories, []);
  });

  test("returns partial repositories and logs a warning when a later page fails", async () => {
    const firstPageData = buildRepositories(500, 1);

    PaginatedFetch.prototype.fetchPage = async (_endpoint, page, pageSize) => {
      if (page === 1) {
        return {
          data: firstPageData,
          pagination: { page: 1, pageTotal: 2, count: 600, pageSize },
        };
      }

      return {
        data: [],
        pagination: { page: 2, pageTotal: 2, count: 600, pageSize },
        error: "Response status: 502",
      };
    };

    const result = await workspaceRepositoryFetcher.fetchWorkspaceRepositories(
      {},
      "workspace-a"
    );

    assert.strictEqual(result.error, null);
    assert.strictEqual(result.partial, true);
    assert.strictEqual(result.warning, "Response status: 502");
    assert.strictEqual(result.repositories.length, 500);
    assert.strictEqual(result.repositories[0].name, "repo-001");
    assert.strictEqual(result.repositories[499].name, "repo-500");
  });
});
