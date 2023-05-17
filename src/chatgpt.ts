import { Browser, BrowserContext, Cookie, Page, firefox } from "playwright-core";
import { BASE_URL, PageController } from "./page-controller";
import { CONTINUE_BUTTON_SELECTOR, DIALOG_SELECTOR, DONE_BUTTON_SELECTOR, EMAIL_INPUT_SELECTOR, LOGIN_BUTTON_SELECTOR, NEXT_BUTTON_SELECTOR, PASSWORD_INPUT_SELECTOR } from "./selectors";
import fs from 'fs';
import { HttpClient } from "./http-client";
import { CookieJar } from "./cookie-jar";

interface UserCredentials {
    username: string,
    password: string
}

interface CallbackFunctions {
    userCredentialsProvider?: () => Promise<UserCredentials>;
    userCredentialsSaver?: (credentials: UserCredentials) => Promise<void>
}

export class ChatGPT {

    readonly #browser: Browser;
    readonly #context: BrowserContext;
    readonly #page: Page;
    readonly #pageController: PageController;
    readonly #browserContextPath: string | undefined;
    
    #internalHTTPClient?: HttpClient;
    #saveUserCredentials: (credentials: UserCredentials) => Promise<void>;
    #retriveUserCredentials: () => Promise<UserCredentials>
    #userCredentials: UserCredentials | undefined;


    /**
     * Creates a new instance of Gpt
     * @param browser The browser instance to use inside of Gpt
     * @param page The page instance to use within Gpt
     */
    private constructor(browser: Browser, context: BrowserContext, page: Page, browserContextPath: string | undefined, callbacks?: CallbackFunctions) {
        this.#browser = browser;
        this.#context = context;
        this.#page = page;
        this.#pageController = new PageController(this.#page);
        this.#browserContextPath = browserContextPath;
        if (callbacks) {
            if (callbacks.userCredentialsSaver) {
                this.#saveUserCredentials = callbacks.userCredentialsSaver;
            } else {
                this.#saveUserCredentials = async (credentials: UserCredentials) => {
                    this.#userCredentials = credentials;
                }
            }
            if (callbacks.userCredentialsProvider) {
                this.#retriveUserCredentials = callbacks.userCredentialsProvider
            } else {
                this.#retriveUserCredentials = async () => {
                    if (this.#userCredentials) {
                        return this.#userCredentials
                    }
                    throw new Error('User credentials are missing, did you logged in once?');
                };
            }
        } else {
            this.#saveUserCredentials = async (credentials: UserCredentials) => {
                this.#userCredentials = credentials;
            }
            this.#retriveUserCredentials = async () => {
                if (this.#userCredentials) {
                    return this.#userCredentials
                }
                throw new Error('User credentials are missing, did you logged in once?');
            };
        }
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
            await this.#passDialog();
            if (this.#browserContextPath !== undefined) {
                await this.#saveBrowserContext();
            }
            await this.#saveUserCredentials({username, password});
        } catch (e) {
            if (await this.#pageController.isLoggedIn()) {
                console.debug('User is already logged in');
                console.log('Cookies');
                console.log(await this.#cookies)
                return;
            }
            throw e;
        } finally {
            if (this.#internalHTTPClient === undefined) {
                this.#internalHTTPClient = new HttpClient(new CookieJar((await this.#cookies), () => this.#regenerateCookies()));
            }   
        }
    }

    async #passDialog() {
        const dialogElement = await this.#page.waitForSelector(DIALOG_SELECTOR);
        if (dialogElement === null) {
            return;
        }
        let button: ElementHandle<HTMLElement> | null;
        do {
            button = await dialogElement.$(NEXT_BUTTON_SELECTOR) as ElementHandle<HTMLElement> | null;
            await button?.click();
        } while(button != null);
        await (await dialogElement.$(DONE_BUTTON_SELECTOR))?.click();
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
        await this.#context.storageState({ path: this.#browserContextPath });
    }

    /**
     * Login again with the user credentials and regenerate cookies
     * @returns The list of cookies regenerated after logging in again with the user credentials
     */
    async #regenerateCookies(): Promise<Cookie[]> {
        if (this.#browserContextPath) {
            fs.rmSync(this.#browserContextPath)
        }
        const {username, password} = await this.#retriveUserCredentials();
        await this.login(username, password)
        return this.#cookies;
    }

    /**
     * Returns the internal HTTP client if it's defined, if it is not defined throws an Error.
     */
    get #httpClient(): HttpClient {
        if (this.#internalHTTPClient === undefined) {
            throw new Error('HTTP Client is not defined yet. Did you logged in ?');
        }
        return this.#internalHTTPClient;
    }

    /**
     * Creates a new instance of Gpt asyncronhously
     * @returns A new instance of Gpt
     */
    static async init(options: { headless: boolean, browserContextPath?: string }): Promise<ChatGPT> {
        const browser = await firefox.launch({ headless: options.headless });
        const context = await createBrowserContextFromLocal(browser, options.browserContextPath)
        const page = await context.newPage();
        await page.goto(BASE_URL);
        return new ChatGPT(browser, context, page, options.browserContextPath);
    }
}

/**
 * Creates a browser context from a filePath if it's given and pointing to an existing filePath
 * @param browser The instance of the browser
 * @param filePath The filePath where the browserContext is stored locally
 * @returns A promise with the created browser context
 */
async function createBrowserContextFromLocal(browser: Browser, filePath?: string): Promise<BrowserContext> {
    return browser.newContext({ storageState: (filePath && fs.existsSync(filePath)) ? filePath : undefined });
}