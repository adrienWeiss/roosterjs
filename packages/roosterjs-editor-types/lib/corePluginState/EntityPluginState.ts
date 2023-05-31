/**
 * The state object for EntityPlugin
 */
export default interface EntityPluginState {
    /**
     * @deprecated
     * Last clicking point when mouse down event happens
     */
    clickingPoint?: { pageX: number; pageY: number };

    /**
     * All known entity elements
     */
    knownEntityElements: HTMLElement[];

    /**
     * @deprecated
     */
    shadowEntityCache?: Record<string, HTMLElement>;
}
