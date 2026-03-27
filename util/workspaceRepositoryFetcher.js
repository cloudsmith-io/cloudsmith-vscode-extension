const vscode = require("vscode");
const { CloudsmithAPI } = require("./cloudsmithAPI");
const { PaginatedFetch } = require("./paginatedFetch");

const WORKSPACE_REPOSITORY_PAGE_SIZE = 500;

function sortRepositories(repositories) {
  return [...repositories].sort((left, right) => {
    const leftName = typeof left.name === "string" ? left.name : "";
    const rightName = typeof right.name === "string" ? right.name : "";

    return leftName.localeCompare(rightName, undefined, {
      sensitivity: "base",
    });
  });
}

async function fetchWorkspaceRepositories(context, workspace) {
  const cloudsmithAPI = new CloudsmithAPI(context);
  const paginatedFetch = new PaginatedFetch(cloudsmithAPI);
  const endpoint = `repos/${workspace}/?sort=name`;

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: `Loading repositories for ${workspace}...`,
    },
    async progress => {
      const repositories = [];
      let page = 1;
      let knownPageTotal = null;

      while (true) {
        progress.report({
          message: knownPageTotal ? `Page ${page} of ${knownPageTotal}` : `Page ${page}`,
        });

        const result = await paginatedFetch.fetchPage(
          endpoint,
          page,
          WORKSPACE_REPOSITORY_PAGE_SIZE
        );

        if (result.error) {
          if (page === 1) {
            return {
              repositories: [],
              error: result.error,
              warning: null,
              partial: false,
            };
          }

          console.warn(
            `[WorkspaceRepositories] Failed to load additional repositories for ${workspace} on page ${page}: ${result.error}`
          );

          return {
            repositories: sortRepositories(repositories),
            error: null,
            warning: result.error,
            partial: true,
          };
        }

        const pageData = Array.isArray(result.data) ? result.data : [];
        const currentPage = result.pagination?.page || page;
        const pageTotal = result.pagination?.pageTotal || currentPage;

        knownPageTotal = pageTotal;
        repositories.push(...pageData);

        if (pageData.length < WORKSPACE_REPOSITORY_PAGE_SIZE || currentPage >= pageTotal) {
          break;
        }

        page += 1;
      }

      return {
        repositories: sortRepositories(repositories),
        error: null,
        warning: null,
        partial: false,
      };
    }
  );
}

module.exports = {
  WORKSPACE_REPOSITORY_PAGE_SIZE,
  fetchWorkspaceRepositories,
};
