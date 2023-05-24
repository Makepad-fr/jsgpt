import { Browser, BrowserContext, Cookie, Page, firefox, Response, Request, ElementHandle } from "playwright-core";
import { ACCOUNTS_CHECK_API_URL, BASE_URL, CONVERSATION_HISTORY_API_URL, MODELS_API_URL, PageController, SESSION_API_URL } from "./page-controller";
import { CONTINUE_BUTTON_SELECTOR, DIALOG_SELECTOR, DONE_BUTTON_SELECTOR, EMAIL_INPUT_SELECTOR, LOGIN_BUTTON_SELECTOR, NEXT_BUTTON_SELECTOR, PASSWORD_INPUT_SELECTOR } from "./selectors";
import fs from 'fs';
import { EventEmitter } from "stream";
import { IdBasedSet } from "./id-based-set";

interface UserCredentials {
    username: string,
    password: string
}

interface CallbackFunctions {
    userCredentialsProvider?: () => Promise<UserCredentials>;
    userCredentialsSaver?: (credentials: UserCredentials) => Promise<void>
}


const UNINITIALISED_ERROR = new Error('Account is not yet initialised, please wait until all properties are initialised')


export const SESSION_UPDATED_EVENT = 'SESSION_UPDATED'
export const AVAILABLE_MODELS_UPDATED_EVENT = 'AVAILABLE_MODELS_UPDATED'
export const USER_ACCOUNT_DATA_UPDATED_EVENT = "USER_ACCOUNT_DATA_UPDATED";
export const CONVERSATION_HISTORY_UPDATED_EVENT = "CONVERSATION_HISTORY_UPDATED";

export class ChatGPT extends EventEmitter{

    readonly #browser: Browser;
    readonly #context: BrowserContext;
    readonly #page: Page;
    readonly #pageController: PageController;
    readonly #browserContextPath: string | undefined;

    #saveUserCredentials: (credentials: UserCredentials) => Promise<void>;
    #retriveUserCredentials: () => Promise<UserCredentials>
    #userCredentials: UserCredentials | undefined;

    #_session: SessionData | undefined;
    #_availableModels: AvailableModelsData | undefined;
    #_account: UserAccountData | undefined;
    #_conversationHistory: IdBasedSet<ConversationItem>;

    /**
     * Creates a new instance of Gpt
     * @param browser The browser instance to use inside of Gpt
     * @param page The page instance to use within Gpt
     */
    private constructor(browser: Browser, context: BrowserContext, page: Page, browserContextPath: string | undefined, callbacks?: CallbackFunctions) {
        super();
        this.#browser = browser;
        this.#context = context;
        this.#page = page;
        this.#initPageListeners();
        this.#pageController = new PageController(this.#page);
        this.#browserContextPath = browserContextPath;
        this.#_conversationHistory = new IdBasedSet<ConversationItem>();
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
            await this.#saveUserCredentials({ username, password });
        } catch (e) {
            if (await this.#pageController.isLoggedIn()) {
                return;
            }
            throw e;
        }
    }

    /**
     * Updates the current session data with the given session data.
     * It emits a SESSION_UPDATED_EVENT event after the internal session data is updated
     */
    set #session(data: SessionData) {
        this.#_session = data;
        this.emit(SESSION_UPDATED_EVENT, this);
    }

    /**
     * Get the current session data
     */
    get session(): SessionData {
        if (this.#_session) {
            return this.#_session;
        }
        throw UNINITIALISED_ERROR;
    } 

    /**
     * Update internal available models property with the given available models data
     * this operations emits AVAILABLE_MODELS_UPDATED_EVENT event
     */
    set #availableModels(data: AvailableModelsData) {
        this.#_availableModels = data;
        this.emit(AVAILABLE_MODELS_UPDATED_EVENT, this);
    }

    /**
     * Get available models
     */
    get availableModels(): AvailableModelsData {
        if (this.#_availableModels) {
            return this.#_availableModels;
        }
        throw UNINITIALISED_ERROR;
    }


    /**
     * Updates the internal user account data property and emits USER_ACCOUNT_DATA_UPDATED_EVENT event
     */
    set #account(data: UserAccountData) {
        this.#_account = data;
        this.emit(ACCOUNTS_CHECK_API_URL, this);
    }

    /**
     * Get user account details or undefined
     */
    get account(): UserAccountData {
        if (this.#_account) {
            return this.#_account;
        }
        throw UNINITIALISED_ERROR;
    }


    /**
     * Adds an array of ConversationItem to the current conversation history. If at least one item is added, 
     * it triggers CONVERSATION_HISTORY_UPDATED_EVENT event
     * @param data Items to add to the conversation history
     */
    #addItemsToConversationHistory(data: ConversationItem[]) {
        const addedElementCount = this.#_conversationHistory.addAll(data);
        if (addedElementCount > 0) {
            this.emit(CONVERSATION_HISTORY_UPDATED_EVENT, this);
        }
    }

    /**
     * Get the user's conversation history
     */
    get conversationHistory(): ConversationItem[] {    
        return this.#_conversationHistory.array;
     }


    /**
     * Pass the announcements dialog right after the login
     */
    async #passDialog() {
        const dialogElement = await this.#page.waitForSelector(DIALOG_SELECTOR);
        if (dialogElement === null) {
            return;
        }
        let button: ElementHandle<HTMLElement> | null;
        do {
            button = await dialogElement.$(NEXT_BUTTON_SELECTOR) as ElementHandle<HTMLElement> | null;
            await button?.click();
        } while (button != null);
        await (await dialogElement.$(DONE_BUTTON_SELECTOR))?.click();
    }


    /**
     * Open log in form, by clicking to the log in button.
     * If the current page is not the login page, it does nothing
     */
    async #openLoginForm() {
        if (this.#pageController.isLoginPage) {
            await this.#page.waitForLoadState('networkidle');
            await this.#page.click(LOGIN_BUTTON_SELECTOR);
            await this.#page.waitForLoadState('networkidle');
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
        const { username, password } = await this.#retriveUserCredentials();
        await this.login(username, password)
        return this.#cookies;
    }

    /**
     * Initialies different event listeners on the current page.
     */
    #initPageListeners() {
        this.#page.on('requestfinished', async (request) => this.#handleRequestFinishedEvent(request));
    }

    /**
     * Handle the requestfinished event, which is trigerred when a request is finished successfully.
     * @param request The finished request to handle
     */
    async #handleRequestFinishedEvent(request: Request) {
        const requestUrl = request.url();
        if (requestUrl.startsWith(BASE_URL)) {
            // console.log(`Request: ${request.method()} ${requestUrl}`);
            const response = await request.response();
            if (response) {
                await this.#handleResponse(requestUrl, response);
            }
        }
    }

    /**
     * Handle an HTTP request response
     * @param requestUrl The URL of the request
     * @param response The response to handle
     */
    async #handleResponse(requestUrl: string, response: Response) {
        const responseHeaders = response.headers();
        if (responseHeaders && responseHeaders['content-type']?.includes('application/json')) {
            await this.#handleJSONResponse(requestUrl, response, await response.json());
        }
    }

    /**
     * Handle a JSON response depending on the request URL and the response instance
     * @param requestURL The URL of the request
     * @param response The response object got for the request
     * @param data The JSON data contained in the response
     */
    async #handleJSONResponse(requestURL: string, response: Response, data: unknown) {
        if (requestURL.startsWith(SESSION_API_URL)) {
            this.#session = data as SessionData;
        }
        if (requestURL.startsWith(MODELS_API_URL)) {
            this.#availableModels = data as AvailableModelsData;
        }
        if (requestURL.startsWith(ACCOUNTS_CHECK_API_URL)) {
            this.#account = data as UserAccountData;
        }
        if (requestURL.startsWith(CONVERSATION_HISTORY_API_URL)) {
            this.#addItemsToConversationHistory((data as ConversationHistory).items)
            
        }
        console.debug(`New request to URL: ${requestURL}`)

        // TODO: Handle https://chat.openai.com/backend-api/settings/beta_features
        // console.log('Response');
        // console.log(await response?.json());
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

