export class IdBasedSet<T extends {id: string}> {
    #content: Record<string, Omit<T, "id">>;

    constructor() {
        this.#content = {};
    }

    /**
     * Checks wether the current set contains an element with the given id
     * @param id The id to check if the current set contains
     * @returns True if the current set contains an element with the given id, false if not
     */
    contains(id: string) {
        return this.#content[id] !== undefined
    }

    /**
     * Returns the element with the given id
     * @param id The id of the element to get
     * @returns The element with the given id
     */
    get(id: string): T|undefined {
        if (this.contains(id)) {
            return <T>{
                id,
                ...this.#content[id]
            }
        }
        return undefined;
    }

    /**
     * Adds an element if it does not already exists
     * @param elem The element to add
     * @returns True if the element added correctly, false if not
     */
    add(elem: T): boolean {
        if (this.contains(elem.id)) {
            return false;
        }
        this.#content[elem.id] = elem
        return true;
    }

    /**
     * Adds a list of elements to the current set
     * @param elems The list of elements to add
     * @returns The number of elements added
     */
    addAll(elems: T[]): number {
        return elems.map(e => this.add(e)).filter(r => r === true).length
    }

    /**
     * Removes the element with the given id from the current set
     * @param id The id of the element to remove
     * @returns True if the element with the given id is removed, false otherwise
     */
    remove(id: string): boolean {
        if (this.contains(id)) {
            delete this.#content[id];
            return true;
        }
        return false;
    }

    /**
     * Get the number of elements in the current set
     */
    get size(): number {
        return Object.keys(this.#content).length
    }

    /**
     * Get the array representation of the current set
     */
    get array(): T[] {
        return Object.keys(this.#content).map(e => this.get(e)) as T[];
    }

}