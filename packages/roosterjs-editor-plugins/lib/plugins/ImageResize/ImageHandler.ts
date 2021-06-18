import { Entity } from 'roosterjs-editor-types';

export default interface ImageHandler {
    setCurrentImage: (image: HTMLImageElement | null, selectImage?: boolean) => void;

    getImageWrapper: () => HTMLElement;

    isHandlerEntity: (entity: Entity) => boolean;

    removeWrappers: (wrapper?: HTMLElement) => void;

    removeTempAttributes: (img: HTMLImageElement) => void;
}
