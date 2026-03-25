// Handles paginated API responses from Cloudsmith.
// Returns both data and pagination metadata.

const MAX_FETCH_ALL_PAGES = 20;

class PaginatedFetch {
    constructor(cloudsmithAPI) {
        this.api = cloudsmithAPI;
    }

    /**
     * Fetch a single page with pagination metadata.
     *
     * @param   endpoint  Base endpoint (e.g., 'packages/owner/')
     * @param   page      Page number (1-indexed)
     * @param   pageSize  Results per page
     * @param   query     Optional query string to append
     * @returns { data: [], pagination: { page, pageTotal, count, pageSize } }
     */
    async fetchPage(endpoint, page, pageSize, query) {
        const separator = endpoint.includes('?') ? '&' : '?';
        let url = `${endpoint}${separator}page=${page}&page_size=${pageSize}`;

        if (query) {
            url += `&query=${encodeURIComponent(query)}`;
        }

        const result = await this.api.getWithHeaders(url);

        // Handle error case (makeRequest returns error string)
        if (typeof result === 'string') {
            return {
                data: [],
                pagination: { page: 1, pageTotal: 1, count: 0, pageSize: pageSize },
                error: result
            };
        }

        return {
            data: result.data || [],
            pagination: {
                page: parseInt(result.headers.page, 10) || page,
                pageTotal: parseInt(result.headers.pageTotal, 10) || 1,
                count: parseInt(result.headers.count, 10) || 0,
                pageSize: parseInt(result.headers.pageSize, 10) || pageSize,
            }
        };
    }

    /**
     * Fetch all available pages, capped at a hard ceiling to avoid runaway scans.
     *
     * @param   endpoint  Base endpoint (e.g., 'packages/owner/')
     * @param   pageSize  Results per page
     * @param   maxPagesOrQuery  Optional max page hint or query string
     * @param   query     Optional query string when a max page hint is supplied
     * @returns { data: [], pagination: { page, pageTotal, count, pageSize } }
     */
    async fetchAll(endpoint, pageSize, maxPagesOrQuery, query) {
        let maxPages = MAX_FETCH_ALL_PAGES;
        let searchQuery = query;

        if (typeof maxPagesOrQuery === "number") {
            maxPages = Math.max(1, Math.floor(maxPagesOrQuery));
        } else if (typeof maxPagesOrQuery === "string") {
            searchQuery = maxPagesOrQuery;
        }

        maxPages = Math.min(maxPages, MAX_FETCH_ALL_PAGES);

        const allData = [];
        let pagination = {
            page: 1,
            pageTotal: 1,
            count: 0,
            pageSize: pageSize,
        };

        for (let page = 1; page <= maxPages; page++) {
            const result = await this.fetchPage(endpoint, page, pageSize, searchQuery);
            if (result.error) {
                return result;
            }

            allData.push(...(result.data || []));
            pagination = {
                ...result.pagination,
                pageTotal: Math.min(result.pagination.pageTotal || 1, MAX_FETCH_ALL_PAGES),
            };

            if (page >= result.pagination.pageTotal) {
                break;
            }
        }

        return {
            data: allData,
            pagination,
        };
    }
}

module.exports = { PaginatedFetch };
