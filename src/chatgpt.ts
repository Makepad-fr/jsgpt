import { Browser, BrowserContext, Cookie, Page, firefox } from "playwright-core";
import { BASE_URL, PageController } from "./page-controller";
import { CONTINUE_BUTTON_SELECTOR, EMAIL_INPUT_SELECTOR, LOGIN_BUTTON_SELECTOR, PASSWORD_INPUT_SELECTOR } from "./selectors";
import fs from 'fs';

export class Gpt {

    readonly #browser: Browser;
    readonly #context: BrowserContext;
    readonly #page: Page;
    readonly #pageController: PageController;
    readonly #browserContextPath: string|undefined;

    /**
     * Creates a new instance of Gpt
     * @param browser The browser instance to use inside of Gpt
     * @param page The page instance to use within Gpt
     */
    private constructor(browser: Browser, context: BrowserContext, page: Page, browserContextPath: string|undefined) {
        this.#browser = browser;
        this.#context = context;
        this.#page = page;
        this.#pageController = new PageController(this.#page);
        this.#browserContextPath = browserContextPath;
    }

    /**
     * Login to the ChatGPT account using username and password
     * @param username The username used to login
     * @param password The password used to login
     */
    async login(username: string, password: string) {
        try {
            await this.#openLoginForm();
            await this.#page.fill(EMAIL_INPUT_SELECTOR, username);
            await this.#page.click(CONTINUE_BUTTON_SELECTOR);
            await this.#page.fill(PASSWORD_INPUT_SELECTOR, password);
            await this.#page.click(CONTINUE_BUTTON_SELECTOR);
            if (this.#browserContextPath !== undefined) {
                await this.#saveBrowserContext();
            }
        } catch (e) {
            if (await this.#pageController.isLoggedIn()) {
                console.debug('User is already logged in');
                return;
            }
            throw e;
        }
    }

    /**
     * Open log in form, by clicking to the log in button.
     * If the current page is not the login page, it does nothing
     */
    async #openLoginForm() {
        if (this.#pageController.isLoginPage) {
            console.debug('Currently in the login page');
            await this.#page.click(LOGIN_BUTTON_SELECTOR);
            return;
        }
        // TODO: Create a custom exception
        throw new Error(`You need to be on the login page to open the login form.`);
    }

    /**
     * Return current page's cookies
     */
    get #cookies(): Promise<Cookie[]> {
        return this.#context.cookies();
    }

    /**
     * Saves the browser context to the given filename
     * @param filePath The name of the file to save the browser context
     */
    async #saveBrowserContext() {
        await this.#context.storageState({path: this.#browserContextPath});
    }

    /**
     * Creates a new instance of Gpt asyncronhously
     * @returns A new instance of Gpt
     */
    static async init(options: { headless: boolean, browserContextPath?: string }): Promise<Gpt> {
        const browser = await firefox.launch({ headless: options.headless });
        const context = await createBrowserContextFromLocal(browser, options.browserContextPath)
        const page = await context.newPage();
        await page.goto(BASE_URL);
        return new Gpt(browser, context, page, options.browserContextPath);
    }
}

/**
 * Creates a browser context from a filePath if it's given and pointing to an existing filePath
 * @param browser The instance of the browser
 * @param filePath The filePath where the browserContext is stored locally
 * @returns A promise with the created browser context
 */
async function createBrowserContextFromLocal(browser: Browser, filePath?: string): Promise<BrowserContext> {
    return browser.newContext({storageState: (filePath && fs.existsSync(filePath)) ? filePath : undefined});
}