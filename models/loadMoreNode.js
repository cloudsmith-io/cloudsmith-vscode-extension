// Load More node for paginated search results.

const vscode = require("vscode");

class LoadMoreNode {
    constructor(currentPage, totalPages, totalCount) {
        this.currentPage = currentPage;
        this.totalPages = totalPages;
        this.totalCount = totalCount;
    }

    getTreeItem() {
        return {
            label: `Load More Results (page ${this.currentPage} of ${this.totalPages}, ${this.totalCount} total)`,
            tooltip: "Click to load the next page of search results",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "loadMore",
            iconPath: new vscode.ThemeIcon('ellipsis'),
            command: {
                command: 'cloudsmith-vsc.searchNextPage',
                title: 'Load More Results',
            },
        };
    }

    getChildren() {
        return [];
    }
}

module.exports = LoadMoreNode;
