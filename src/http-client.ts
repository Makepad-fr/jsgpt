import { CookieJar } from "./cookie-jar";
import http from 'http';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const SSE_HEADER_VALUE = 'text/event-stream';

interface RequestOptions {
    hostname: string;
    port?: number;
    path: string;
    method: HttpMethod;
    headers?: http.OutgoingHttpHeaders;
}

export class HttpClient {
    readonly #cookieJar: CookieJar;
    readonly #baseHeaders: http.OutgoingHttpHeaders;

    /**
     * Creates a new instance of HTTP client by passing an instance of cookie jar
     * @param cookieJar The cookie jar used inside of the HTTP client
     */
    constructor(cookieJar: CookieJar, baseHeaders: http.OutgoingHttpHeaders = {}) {
        this.#cookieJar = cookieJar;
        this.#baseHeaders = baseHeaders;
    }

    /**
     * Makes an HTTP request with given parameters
     * @param url The URL to make the HTTP request
     * @param method The HTTP request method
     * @param headers The HTTP request headers
     * @param body The body contains the data to be passed in the HTTP request
     * @param callback The callback function used to handle events from the server when doing requests to an API that returns SSE
     */
    async request<T,R>(url: string, method: HttpMethod, headers: http.OutgoingHttpHeaders = {}, body?: T, callback?: (data: R) => void) {
        const options = await this.#createRequestOptions(url, method, headers);
        if (options.headers && options.headers['Accept'] === SSE_HEADER_VALUE) {
            if (callback === undefined) {
                throw new Error('You should provide a callback for SSE requests');
            }
            return this.#sseHttpRequest(options, callback, body);
        }
        // If the Accept header is not server side event value, we will assume that it's a JSON
        if (callback !== undefined) {
            console.warn('Callback function provided for non SSE HTTP call. The function will be omitted');
        }
        return this.#jsonHttpRequest(options, body);

    }

    /**
     * Creates request options to use inside of HTTP request, providing always updated Cookie header using the internal cookie jar.
     * @param url The URL to d the request
     * @param method The HTTP method for the request
     * @param headers The additional headers to pass in the request
     * @returns 
     */
    async #createRequestOptions(url: string, method: HttpMethod, headers: http.OutgoingHttpHeaders = {}): Promise<RequestOptions> {
        const parsedURL = new URL(url);
        return <RequestOptions>{
            hostname: parsedURL.hostname,
            port: +parsedURL.port,
            path: parsedURL.pathname,
            method,
            headers: await this.#createHeaders(headers)
        }
    }


    /**
     * Create headers by adding default headers to the request
     * @param headers Base headers provided for addinitional information
     */
    async #createHeaders(headers: http.OutgoingHttpHeaders = {}): Promise<http.OutgoingHttpHeaders> {
        return {
            ...headers,
            ...this.#baseHeaders,
            'Cookie': await this.#cookieJar.headerValue,
        }
    }


    /**
     * Creates a HTTP request by handling of server side events (SSE)
     * @param options RequestOptions to use to create the request
     * @param body The body pass to the request
     * @param callback The callback function to handle recieved server side events
     */
    async #sseHttpRequest<T,R>(options: RequestOptions, callback: (data: R) => void, body?: T) {
        const req = http.request(options, res => {
            res.on('data', chunk => {
                callback(chunk);
            });

            res.on('end', () => {
                console.log('Connection closed');
            });
        });
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.on('error', error => console.error(`Request error: ${error.message}`));
        req.end();

    }

    /**
     * Makes an HTTP request to an API that will return a JSON
     * @param options The options for the request
     * @param body The body of the request if applicable
     * @returns A promises that contains a parsed version of the response body.
     */
    async #jsonHttpRequest<T, R>(options: RequestOptions, body?: R): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const json: T = JSON.parse(data);
                        resolve(json);
                    } catch (error) {
                        reject(new Error('Failed to parse response body'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
}