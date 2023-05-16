import { Cookie } from "playwright-core";


export class CookieJar {

    #cookies: Cookie[];
    #cookieSupplier: () => Promise<Cookie[]>;
    /**
     * Creates a cookie jar with the initial cookies and a with a function to refresh cookies
     * @param cookies The content of the cookie jar at the moment of creation
     * @param cookieSupplier A function used to refresh cookies when there are expired cookies in the current cookie jar
     */
    constructor(cookies: Cookie[], cookieSupplier: () => Promise<Cookie[]>) {
        this.#cookies = cookies;
        this.#cookieSupplier = cookieSupplier
    }


    /**
     * Checks if there's at least one expired cookies in the current cookie jar
     * @returns true if there's at least one expired cookie in the cookie jar, false if not
     */
    get #hasExpiredCookies(): boolean {
        return this.#cookies.find((cookie: Cookie) => isCookieExpired(cookie)) !== undefined;
    }

    /**
     * Refresh the content of the cookie jar if there's at least one expired cookie
     */
    async #refresh() {
        if (this.#hasExpiredCookies) {
            // If there's at least one expired cookies, refresh all cookies in the jar
            this.#cookies = await this.#cookieSupplier();
        }
    }

    /**
     * Returns the value for 'Cookie' header with the content of the cookie jar. It refreshs the jar content
     * if necessary.
     */
    get headerValue(): Promise<string> {
        return this.#refresh().then(() => {
            return this.#cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        })
    }

}

/**
 * Checks if a given cookie is expired or not
 * @param cookie The cookie to check whether it's expired or not
 * @returns true if the given cookie is expired, false if not
 */
function isCookieExpired(cookie: Cookie): boolean {
    return (cookie.expires !== -1) && (new Date() > (new Date(cookie.expires * 1000)));
}