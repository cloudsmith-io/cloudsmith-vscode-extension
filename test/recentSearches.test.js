const assert = require('assert');
const { RecentSearches } = require('../util/recentSearches');

suite('RecentSearches Test Suite', () => {

    let mockContext;

    setup(() => {
        // Create a mock context with in-memory globalState
        const store = {};
        mockContext = {
            globalState: {
                get(key) { return store[key]; },
                update(key, value) { store[key] = value; },
            },
        };
    });

    test('add() stores a search entry', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'my-ws', query: 'name:flask' });
        const all = recent.getAll();
        assert.strictEqual(all.length, 1);
        assert.strictEqual(all[0].workspace, 'my-ws');
        assert.strictEqual(all[0].query, 'name:flask');
    });

    test('add() deduplicates by workspace+query', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'ws', query: 'name:flask' });
        recent.add({ workspace: 'ws', query: 'name:django' });
        recent.add({ workspace: 'ws', query: 'name:flask' }); // duplicate
        const all = recent.getAll();
        assert.strictEqual(all.length, 2);
        // Most recent first
        assert.strictEqual(all[0].query, 'name:flask');
        assert.strictEqual(all[1].query, 'name:django');
    });

    test('add() caps at max entries', () => {
        const recent = new RecentSearches(mockContext);
        // Default max is 10, add 12 entries
        for (let i = 0; i < 12; i++) {
            recent.add({ workspace: 'ws', query: `query-${i}` });
        }
        const all = recent.getAll();
        assert.ok(all.length <= 10);
        // Most recent should be query-11
        assert.strictEqual(all[0].query, 'query-11');
    });

    test('getAll() returns entries sorted by most recent first', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'ws', query: 'first', timestamp: 1000 });
        recent.add({ workspace: 'ws', query: 'second', timestamp: 2000 });
        recent.add({ workspace: 'ws', query: 'third', timestamp: 3000 });
        const all = recent.getAll();
        assert.strictEqual(all[0].query, 'third');
        assert.strictEqual(all[1].query, 'second');
        assert.strictEqual(all[2].query, 'first');
    });

    test('clear() removes all entries', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'ws', query: 'name:flask' });
        recent.add({ workspace: 'ws', query: 'name:django' });
        recent.clear();
        const all = recent.getAll();
        assert.strictEqual(all.length, 0);
    });

    test('getAll() returns empty array when nothing stored', () => {
        const recent = new RecentSearches(mockContext);
        const all = recent.getAll();
        assert.ok(Array.isArray(all));
        assert.strictEqual(all.length, 0);
    });

    test('add() sets default scope and timestamp', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'ws', query: 'name:flask' });
        const all = recent.getAll();
        assert.strictEqual(all[0].scope, 'workspace');
        assert.ok(all[0].timestamp > 0);
    });

    test('add() preserves custom scope', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'ws', query: 'name:flask', scope: 'repository' });
        const all = recent.getAll();
        assert.strictEqual(all[0].scope, 'repository');
    });

    test('different workspaces are not deduped', () => {
        const recent = new RecentSearches(mockContext);
        recent.add({ workspace: 'ws1', query: 'name:flask' });
        recent.add({ workspace: 'ws2', query: 'name:flask' });
        const all = recent.getAll();
        assert.strictEqual(all.length, 2);
    });

    test('workspace slug scopes storage keys', () => {
        const recentA = new RecentSearches(mockContext, 'workspace-a');
        const recentB = new RecentSearches(mockContext, 'workspace-b');

        recentA.add({ workspace: 'workspace-a', query: 'name:flask' });
        recentB.add({ workspace: 'workspace-b', query: 'name:django' });

        assert.strictEqual(recentA.getAll().length, 1);
        assert.strictEqual(recentA.getAll()[0].query, 'name:flask');
        assert.strictEqual(recentB.getAll().length, 1);
        assert.strictEqual(recentB.getAll()[0].query, 'name:django');
    });
});
