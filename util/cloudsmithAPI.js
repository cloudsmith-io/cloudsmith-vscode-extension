const apiURL = 'https://api.cloudsmith.io/v1/';
const connectionManager = require('./connectionManager');

class CloudsmithAPI {
    constructor(context){
        this.context = context;
    }

    /**
     * GET request to Cloudsmith API.
     *
     * @param   endpoint  for example 'repos' for v1/repos.
     * @param.  api token
     * @returns json response.
     */
    //async function get(endpoint, apiKey) {
    async get(endpoint, apiKey) {

        if(!apiKey){
            //console.log("API Key not passed in")
            apiKey = await connectionManager.getApiKey(this.context);
            //console.log(apiKey)
        }
        

        const requestOptions = {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'X-Api-Key': apiKey,
            },
        };

        const response = this.makeRequest(endpoint, requestOptions);
        return response;

    }

    /**
     * POST request to Cloudsmith API.
     *
     * @param   endpoint  for example 'repos' for v1/repos.
     * @param   payload  json string payload 
     * @returns json response.
     */

    async post(endpoint, payload, apiKey) {

        const requestOptions = {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'X-Api-Key': apiKey,
            },
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
    async makeRequest(endpoint, requestOptions) {

        const url = apiURL + endpoint;
        //console.log(url)
        try {
            const response = await fetch(url, requestOptions);
            if (!response.ok) {
                //console.log(`Response status: ${response.status} - ${response.statusText}`)
                throw new Error(`Response status: ${response.status} - ${response.statusText}`);       
            }
            const result = response.json();
            return result
        } catch (error) {
            //vscode.window.showErrorMessage(error.message || error);
            return error.message

        }
    }

}

module.exports = { CloudsmithAPI };