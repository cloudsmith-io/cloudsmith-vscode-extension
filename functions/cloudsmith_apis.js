const apiKey = '8759814c39d066a104f9b6c50074cc223b3d1e42';
const apiURL = 'https://api.cloudsmith.io/v1/';


/**
 * GET request to Cloudsmith API.
 *
 * @param   endpoiont  for example 'repos' for v1/repos.
 * @returns json response.
 */
export async function get(endpoint) {

    const requestOptions = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    };

    const response = await makeRequest(endpoint, requestOptions);
    return response;
    //console.log(response);

}

/**
 * POST request to Cloudsmith API.
 *
 * @param   endpoiont  for example 'repos' for v1/repos.
 * @param   payload  json string payload 
 * @returns json response.
 */
export function post(endpoint, payload) {

    const requestOptions = {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'X-Api-Key': apiKey,
        },
        body: payload
    };

    const response = makeRequest(endpoint, requestOptions);
    return response;
}

/**
 * Make the actual request to the API endpoint.
 *
 * @param   endpoint  for example 'repos' for v1/repos.
 * @param   requestOptions Request options such as method, headers and body. 
 * @returns json response.
 */
export async function makeRequest(endpoint, requestOptions) {

    const url = apiURL + endpoint;
    console.log(url);

    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const result = response.json();
        return result
    } catch (error) {
        console.error(error.message);
    }

}