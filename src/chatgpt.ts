import { Browser, Page, firefox } from "playwright-core";
import { BASE_URL, PageController } from "./page-controller";
import { CONTINUE_BUTTON_SELECTOR, EMAIL_INPUT_SELECTOR, LOGIN_BUTTON_SELECTOR, PASSWORD_INPUT_SELECTOR } from "./selectors";

export class Gpt {

    readonly #browser: Browser;
    readonly #page: Page;
    readonly #pageController: PageController;

    /**
     * Creates a new instance of Gpt
     * @param browser The browser instance to use inside of Gpt
     * @param page The page instance to use within Gpt
     */
    private constructor(browser: Browser, page: Page) {
        this.#browser = browser;
        this.#page = page;
        this.#pageController = new PageController(this.#page);
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
        } catch (e) {
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
     * Creates a new instance of Gpt asyncronhously
     * @returns A new instance of Gpt
     */
    static async init(options: { headless: boolean }): Promise<Gpt> {
        const browser = await firefox.launch({ headless: options.headless });
        const page = await browser.newPage();
        await page.goto(BASE_URL);
        return new Gpt(browser, page);
    }
}