// Stores and retrieves recent searches from context.globalState.

const STORAGE_KEY_PREFIX = 'cloudsmith-recentSearches';

class RecentSearches {
    constructor(context, workspaceSlug) {
        this.context = context;
        this.workspaceSlug = workspaceSlug || '';
        this.storageKey = this.workspaceSlug
            ? `${STORAGE_KEY_PREFIX}:${this.workspaceSlug}`
            : STORAGE_KEY_PREFIX;
    }

    /**
     * Add a search entry. Deduplicates by workspace+query.
     * @param {object} entry - { workspace, query, scope, timestamp }
     */
    add(entry) {
        const searches = this.getAll();
        const dedupKey = `${entry.workspace}:${entry.query}`;

        // Remove existing entry with same workspace+query
        const filtered = searches.filter(s => `${s.workspace}:${s.query}` !== dedupKey);

        // Prepend new entry
        filtered.unshift({
            workspace: entry.workspace,
            query: entry.query,
            scope: entry.scope || 'workspace',
            timestamp: entry.timestamp || Date.now(),
        });

        // Cap at max
        const max = this._getMax();
        const capped = filtered.slice(0, max);

        this.context.globalState.update(this.storageKey, capped);
    }

    /**
     * Get all recent searches, sorted by most recent first.
     * @returns {Array} Array of search entries.
     */
    getAll() {
        const max = this._getMax();
        if (max === 0) {
            return [];
        }
        const searches = this.context.globalState.get(this.storageKey) || [];
        return searches.slice(0, max);
    }

    /** Clear all recent searches. */
    clear() {
        this.context.globalState.update(this.storageKey, []);
    }

    /** Get the configured max from settings. */
    _getMax() {
        const vscode = require('vscode');
        const config = vscode.workspace.getConfiguration('cloudsmith-vsc');
        return config.get('recentSearches') ?? 10;
    }
}

module.exports = { RecentSearches };
