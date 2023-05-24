import { Page } from "playwright-core";
import { NEW_CHAT_BUTTON_SELECTOR } from "./selectors";

export const BASE_URL = 'https://chat.openai.com';
export const CHAT_URL = `${BASE_URL}/chat`;
export const LOGIN_PAGE_URL = `${BASE_URL}/auth/login`;
export const SESSION_API_URL = `${BASE_URL}/api/auth/session`;
export const BACKEND_API_BASE_URL = `${BASE_URL}/backend-api`;

export const MODELS_API_URL = `${BACKEND_API_BASE_URL}/models`;
export const ACCOUNTS_CHECK_API_URL = `${BACKEND_API_BASE_URL}/accounts/check`;
export const CONVERSATION_HISTORY_API_URL = `${BACKEND_API_BASE_URL}/conversations`;
export const BETA_FEATURES_API_URL = `${BACKEND_API_BASE_URL}/settings/beta_features`;

export class PageController {
    readonly #page: Page;

    constructor(page: Page) {
        this.#page = page;
    }

    /**
     * Check if the current page is the login page
     */
    get isLoginPage(): boolean {
        console.log(`Current page URL ${this.#page.url()}, login page URL: ${LOGIN_PAGE_URL}`);
        return this.#page.url() === LOGIN_PAGE_URL;
    }

    /**
     * Check if the user is logged in by verifying the "New chat" button in the current page
     * @returns True if the new chat button is available on the page
     */
    async isLoggedIn(): Promise<boolean> {
        try {
            await this.#page.waitForSelector(NEW_CHAT_BUTTON_SELECTOR);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sleep for given number of milliseconds
     * @param timeout The number of milliseconds to sleep for
     */
    async sleep(timeout: number) {
        console.debug(`Will sleep for ${timeout}`);
        return this.#page.waitForTimeout(timeout);
    }
}