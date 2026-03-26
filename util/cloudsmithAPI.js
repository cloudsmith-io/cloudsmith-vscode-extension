// Class to handle Cloudsmith API requests. 
// Utilises the public Cloudsmith v1 API - https://help.cloudsmith.io/reference/introduction

const apiURL = 'https://api.cloudsmith.io/v1/';
const apiV2URL = 'https://api.cloudsmith.io/v2/';
const ALLOWED_API_HOST = "api.cloudsmith.io";
const { CredentialManager } = require('./credentialManager');
const packageJson = require('../package.json');
const vscodeVersion = require('vscode').version;

class CloudsmithAPI {
    constructor(context){
        this.context = context;
    }

    /**
     * GET request to Cloudsmith API.
     *
     * @param   endpoint  for example 'repos' for v1/repos.
     * @param.  api token *optional
     * @returns json response.
     */
    //async function get(endpoint, apiKey) {
    async get(endpoint, apiKey) {

        const credentialManager = new CredentialManager(this.context)

        if(!apiKey){
            apiKey = await credentialManager.getApiKey();
        }

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
        };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const requestOptions = {
            method: 'GET',
            headers: headers,
        };

        const response = this.makeRequest(endpoint, requestOptions);
        return response;

    }

    /**
     * POST request to Cloudsmith API.
     *
     * @param   endpoint  for example 'repos' for v1/repos.
     * @param   payload  json string payload 
     * @param   api token *optional
     * @returns json response.
     */

    async post(endpoint, payload, apiKey) {
        const credentialManager = new CredentialManager(this.context);

        if (!apiKey) {
            apiKey = await credentialManager.getApiKey();
        }

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
        };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const requestOptions = {
            method: 'POST',
            headers: headers,
            body: payload
        };

        const response = await this.makeRequest(endpoint, requestOptions);
        return response;
    }


    /**
     * Make the actual request to the API endpoint.
     *
     * @param   endpoint  for example 'repos' for v1/repos.
     * @param   requestOptions Request options such as method, headers and body. 
     * @returns json response.
     */
    /**
     * GET request that returns both data and pagination headers.
     *
     * @param   endpoint  for example 'packages/owner/' with query params.
     * @param   apiKey *optional
     * @returns { data, headers } where headers contains pagination info.
     */
    async getWithHeaders(endpoint, apiKey) {

        const credentialManager = new CredentialManager(this.context)

        if(!apiKey){
            apiKey = await credentialManager.getApiKey();
        }

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
        };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const requestOptions = {
            method: 'GET',
            headers: headers,
        };

        const response = this.makeRequest(endpoint, requestOptions, true);
        return response;

    }

    /**
     * GET request to Cloudsmith v2 API.
     *
     * @param   endpoint  for example 'workspaces/my-org/policies/'
     * @param   apiKey *optional
     * @returns json response.
     */
    async getV2(endpoint, apiKey) {

        const credentialManager = new CredentialManager(this.context)

        if(!apiKey){
            apiKey = await credentialManager.getApiKey();
        }

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
        };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const requestOptions = {
            method: 'GET',
            headers: headers,
        };

        const response = this.makeRequest(endpoint, requestOptions, false, apiV2URL);
        return response;

    }

    /**
     * GET request to Cloudsmith v2 API that returns both data and pagination headers.
     *
     * @param   endpoint  for example 'workspaces/my-org/policies/'
     * @param   apiKey *optional
     * @returns { data, headers } where headers contains pagination info.
     */
    async getV2WithHeaders(endpoint, apiKey) {

        const credentialManager = new CredentialManager(this.context)

        if(!apiKey){
            apiKey = await credentialManager.getApiKey();
        }

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
        };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const requestOptions = {
            method: 'GET',
            headers: headers,
        };

        const response = this.makeRequest(endpoint, requestOptions, true, apiV2URL);
        return response;

    }

    /**
     * GET upstream configurations for a repository and format.
     *
     * @param   workspace  Workspace/owner slug.
     * @param   repo       Repository slug.
     * @param   format     Package format slug (e.g., 'python', 'npm', 'maven', 'docker').
     * @returns Array of upstream config objects, or empty array on error.
     */
    async getUpstreams(workspace, repo, format) {
        const result = await this.get(`repos/${workspace}/${repo}/upstream/${format}/`);
        if (typeof result === 'string' || !Array.isArray(result)) {
            return [];
        }
        return result;
    }

    /**
     * Make the actual request to the API endpoint.
     *
     * @param   endpoint  for example 'repos' for v1/repos.
     * @param   requestOptions Request options such as method, headers and body.
     * @param   includeHeaders If true, return { data, headers } with pagination info.
     * @returns json response.
     */
    async makeRequest(endpoint, requestOptions, includeHeaders = false, baseUrl = apiURL) {
        try {
            const requestUrl = new URL(endpoint, baseUrl);
            if (requestUrl.protocol !== "https:" || requestUrl.hostname !== ALLOWED_API_HOST) {
                return "Blocked non-Cloudsmith request target.";
            }

            // Add User-Agent header for usage attribution
            if (requestOptions.headers) {
                requestOptions.headers['User-Agent'] = `Cloudsmith-VSCode/${packageJson.version} (VS Code ${vscodeVersion})`;
            }

            // Prevent automatic redirect following to avoid leaking API key
            requestOptions.redirect = 'manual';

            let response = await fetch(requestUrl, requestOptions);

            // Handle 3xx redirects manually with host validation
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('Location');
                if (!location) {
                    return "Received redirect with no Location header.";
                }
                const redirectUrl = new URL(location, requestUrl);
                if (redirectUrl.protocol !== "https:" || redirectUrl.hostname !== ALLOWED_API_HOST) {
                    return "Blocked redirect to untrusted host: " + redirectUrl.hostname;
                }
                response = await fetch(redirectUrl, requestOptions);
            }

            if (!response.ok) {
                let errorBody = '';
                try { errorBody = await response.text(); } catch (_) { /* ignore */ }
                throw new Error(`Response status: ${response.status} - ${response.statusText} - ${errorBody}`);
            }
            const result = await response.json();
            if (includeHeaders) {
                return {
                    data: result,
                    headers: {
                        page: response.headers.get('X-Pagination-Page'),
                        pageTotal: response.headers.get('X-Pagination-PageTotal'),
                        count: response.headers.get('X-Pagination-Count'),
                        pageSize: response.headers.get('X-Pagination-PageSize'),
                    }
                };
            }
            return result;
        } catch (error) {
            return error.message

        }
    }
}

module.exports = { CloudsmithAPI };
