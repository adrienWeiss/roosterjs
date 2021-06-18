import ImageHandler from './ImageHandler';
import ResizeHelper from './ResizeHelper';
import { extractCropInfo, removeCropInfo, storeCropInfo } from './cropInfo';
import { insertEntity } from 'roosterjs-editor-api';
import {
    Entity,
    IEditor,
    PluginEventType,
    PositionType,
    ChangeSource,
} from 'roosterjs-editor-types';
import {
    Browser,
    fromHtml,
    getEntityFromElement,
    getEntitySelector,
    toArray,
} from 'roosterjs-editor-dom';

const ENTITY_TYPE = 'IMAGE_RESIZE_WRAPPER';
const CROP_HANDLE_SIZE = 22;
const CROP_HANDLE_WIDTH = 7;
const OVERLAY_CLASS = 'roosterjsCropOverlay';
const CROP_CONTAINER_CLASS = 'roosterjsCropContainer';
const INNER_HANDLE_HTML = [0, 1]
    .map(layer =>
        [0, 1]
            .map(
                dir =>
                    `<div style="position:absolute;left:${layer}px;bottom:${layer}px;${
                        dir == 0
                            ? `right:${layer}px;height:${CROP_HANDLE_WIDTH - layer * 2}px;`
                            : `top:${layer}px;width:${CROP_HANDLE_WIDTH - layer * 2}px;`
                    };background-color:${layer == 0 ? 'white' : 'black'}"></div>`
            )
            .join('')
    )
    .join('');

const OVERLAY_HTML = `<div style="position:absolute;background-color:rgb(0,0,0,0.5);pointer-events:none" class="${OVERLAY_CLASS}"></div>`;
const CROP_CONTAINER_HTML = `<div style="position:absolute;overflow:hidden;pointer-events:none" class="${CROP_CONTAINER_CLASS}"></div>`;
const CROP_HELPER_HTML = `${CROP_CONTAINER_HTML}${OVERLAY_HTML}${OVERLAY_HTML}${OVERLAY_HTML}${OVERLAY_HTML}`;
const ROTATION: Record<string, number> = {
    sw: 0,
    nw: 90,
    ne: 180,
    se: 270,
};

/**
 * @internal
 */
export default class ImageCropHandler implements ImageHandler {
    private image: HTMLImageElement | null;
    private resizeHelpers: ResizeHelper<[string, string]>[];
    private left: number;
    private top: number;
    private right: number;
    private bottom: number;
    private baseX1: number;
    private baseY1: number;
    private baseX2: number;
    private baseY2: number;
    private initWidth: number;
    private initHeight: number;

    constructor(private editor: IEditor, private minWidth: number, private minHeight: number) {}

    setCurrentImage(image: HTMLImageElement | null, selectImage?: boolean) {
        if (this.editor.contains(this.image) && this.image != image) {
            this.hideResizeHandles();

            if (selectImage) {
                this.editor.select(this.image);
            }
        }

        this.image = image;

        if (this.image) {
            this.createWrapper();
        }
    }

    getImageWrapper() {
        const entity = getEntityFromElement(this.image?.parentNode as HTMLElement);

        return entity?.type == ENTITY_TYPE ? entity.wrapper : null;
    }

    isHandlerEntity(entity: Entity) {
        return entity?.type == ENTITY_TYPE;
    }

    /**
     * Remove the temp wrapper of the image
     * @param wrapper The wrapper object to remove. If not specified, remove all existing wrappers.
     */
    removeWrappers = (wrapper?: HTMLElement) => {
        const wrappers = wrapper
            ? [wrapper]
            : this.editor.queryElements(getEntitySelector(ENTITY_TYPE));

        wrappers.forEach(wrapper => {
            const parent = wrapper?.parentNode;
            const img = wrapper?.querySelector('img');

            if (img && parent) {
                img.style.transform = wrapper.style.transform;
                parent.insertBefore(img, wrapper);
                parent.removeChild(wrapper);
            }
        });
    };

    removeTempAttributes(img: HTMLImageElement) {
        removeCropInfo(img);
    }

    private hideResizeHandles() {
        this.resizeHelpers?.forEach(helper => helper.dispose());
        this.resizeHelpers = null;

        const wrapper = this.getImageWrapper();
        if (wrapper) {
            this.removeWrappers(wrapper);
        }

        this.cropImage(this.image);
    }

    private createWrapper() {
        const { wrapper } = insertEntity(
            this.editor,
            ENTITY_TYPE,
            this.image,
            false /*isBlock*/,
            true /*isReadonly*/
        );

        wrapper.style.position = 'relative';
        wrapper.style.display = Browser.isSafari ? 'inline-block' : 'inline-flex';
        wrapper.style.transform = this.image.style.transform;
        this.image.style.transform = '';
        this.editor.select(wrapper, PositionType.Before);

        const doc = this.editor.getDocument();
        const cropHelpers = fromHtml(CROP_HELPER_HTML, doc);
        const container = cropHelpers[0] as HTMLElement;
        cropHelpers.forEach(node => wrapper.appendChild(node));

        this.resizeHelpers = [];
        ['w', 'e'].forEach(x =>
            ['s', 'n'].forEach(y => {
                const html = `<div style="position:absolute;pointer-events:auto;cursor:${y}${x}-resize;${
                    x == 'w' ? 'left' : 'right'
                }:0;${
                    y == 's' ? 'bottom' : 'top'
                }:0;width:${CROP_HANDLE_SIZE}px;height:${CROP_HANDLE_SIZE}px;transform:rotate(${
                    ROTATION[y + x]
                }deg)">${INNER_HANDLE_HTML}</div>`;

                const div = fromHtml(html, container.ownerDocument)[0] as HTMLElement;
                container.appendChild(div);

                this.resizeHelpers.push(
                    new ResizeHelper(div, [x, y], this.onResizeBegin, this.onResize)
                );
            })
        );

        const cropInfo = extractCropInfo(this.image);

        this.initWidth = this.image.clientWidth / (1 - cropInfo.left - cropInfo.right);
        this.initHeight = this.image.clientHeight / (1 - cropInfo.top - cropInfo.bottom);
        this.image.src = cropInfo.src;
        this.image.style.width = this.initWidth + 'px';
        this.image.style.height = this.initHeight + 'px';
        this.setCrop(
            this.initWidth * cropInfo.left,
            this.initHeight * cropInfo.top,
            this.initWidth * cropInfo.right,
            this.initHeight * cropInfo.bottom
        );
    }

    private setCrop(x1: number, y1: number, x2: number, y2: number) {
        const wrapper = this.getImageWrapper();

        if (wrapper) {
            this.left = x1;
            this.right = x2;
            this.top = y1;
            this.bottom = y2;

            const overlays = toArray(
                wrapper.querySelectorAll('.' + OVERLAY_CLASS)
            ) as HTMLElement[];
            const container = wrapper.querySelector('.' + CROP_CONTAINER_CLASS) as HTMLElement;

            if (container && overlays.length == 4) {
                setSize(
                    container,
                    this.left,
                    this.top,
                    this.right,
                    this.bottom,
                    undefined,
                    undefined
                );
                setSize(overlays[0], 0, 0, x2, undefined, undefined, y1);
                setSize(overlays[1], undefined, 0, 0, y2, x2, undefined);
                setSize(overlays[2], x1, undefined, 0, 0, undefined, y2);
                setSize(overlays[3], 0, y1, undefined, 0, x1, undefined);
            }
        }
    }

    private cropImage(editingImage: HTMLImageElement) {
        const cropInfo = extractCropInfo(editingImage);
        const width = editingImage.clientWidth;
        const height = editingImage.clientHeight;

        cropInfo.left = this.left / width;
        cropInfo.top = this.top / height;
        cropInfo.right = this.right / width;
        cropInfo.bottom = this.bottom / height;

        if (!this.editor.isDisposed()) {
            const originalWidth = editingImage.naturalWidth;
            const originalHeight = editingImage.naturalHeight;
            const imageWidth = originalWidth * (1 - cropInfo.left - cropInfo.right);
            const imageHeight = originalHeight * (1 - cropInfo.top - cropInfo.bottom);
            const canvas = document.createElement('canvas');

            canvas.setAttribute('width', imageWidth.toString());
            canvas.setAttribute('height', imageHeight.toString());

            const context = canvas.getContext('2d');
            context.drawImage(
                editingImage,
                originalWidth * cropInfo.left,
                originalHeight * cropInfo.top,
                imageWidth,
                imageHeight,
                0,
                0,
                imageWidth,
                imageHeight
            );

            const newSrc = canvas.toDataURL();
            const event = this.editor.triggerPluginEvent(PluginEventType.EditImage, {
                image: editingImage,
                newSrc: newSrc,
            });

            storeCropInfo(editingImage, cropInfo);
            editingImage.src = event.newSrc;
            editingImage.style.width = width * (1 - cropInfo.left - cropInfo.right) + 'px';
            editingImage.style.height = height * (1 - cropInfo.top - cropInfo.bottom) + 'px';
            this.editor.addUndoSnapshot();
            this.editor.triggerContentChangedEvent(ChangeSource.ImageCrop);
        }
    }

    private onResizeBegin = () => {
        this.baseX1 = this.left;
        this.baseY1 = this.top;
        this.baseX2 = this.right;
        this.baseY2 = this.bottom;
    };

    private onResize = ([x, y]: [string, string], deltaX: number, deltaY: number) => {
        const left =
            x == 'w'
                ? getInRange(this.baseX1 + deltaX, this.initWidth - this.right - this.minWidth)
                : this.left;
        const top =
            y == 'n'
                ? getInRange(this.baseY1 + deltaY, this.initHeight - this.bottom - this.minHeight)
                : this.top;
        const right =
            x == 'e'
                ? getInRange(this.baseX2 - deltaX, this.initWidth - this.left - this.minWidth)
                : this.right;
        const bottom =
            y == 's'
                ? getInRange(this.baseY2 - deltaY, this.initHeight - this.top - this.minHeight)
                : this.bottom;
        this.setCrop(left, top, right, bottom);
    };
}

function getInRange(value: number, max: number) {
    return Math.max(Math.min(value, max), 0);
}

function setSize(
    element: HTMLElement,
    left: number,
    top: number,
    right: number,
    bottom: number,
    width: number,
    height: number
) {
    element.style.left = left === undefined ? null : left + 'px';
    element.style.top = top === undefined ? null : top + 'px';
    element.style.right = right === undefined ? null : right + 'px';
    element.style.bottom = bottom === undefined ? null : bottom + 'px';
    element.style.width = width === undefined ? null : width + 'px';
    element.style.height = height === undefined ? null : height + 'px';
}
