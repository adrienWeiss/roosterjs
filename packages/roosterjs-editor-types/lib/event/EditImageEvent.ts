import BasePluginEvent from './BasePluginEvent';
import { PluginEventType } from './PluginEventType';

export default interface EditImageEvent extends BasePluginEvent<PluginEventType.EditImage> {
    /**
     * The image element that is being changed
     */
    image: HTMLImageElement;

    /**
     * New src of the changed image, in DataUri format.
     * Plugin can modify this string so that the modified one will be set to the image element
     */
    newSrc: string;
}
