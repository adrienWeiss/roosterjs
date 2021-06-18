import ImageHandler from './ImageHandler';
import ResizeHelper from './ResizeHelper';
import { Browser, fromHtml, getEntityFromElement, getEntitySelector } from 'roosterjs-editor-dom';
import { insertEntity } from 'roosterjs-editor-api';
import {
    ChangeSource,
    Entity,
    ExperimentalFeatures,
    IEditor,
    PositionType,
} from 'roosterjs-editor-types';

const ENTITY_TYPE = 'IMAGE_RESIZE_WRAPPER';
const ROTATE_HANDLE_CLASS = 'roosterjsRotateHandle';

/**
 * Resize Handle Definitions
 *
 * There are 8 resize handles, we put them onto a Cartesian coordinates system:
 * [0,2]      [1,2]      [2,2]
 *
 * [0,1]                 [2,1]
 *
 * [0,0]      [1,0]      [2,0]
 * Then we can use a two-dimensional array to store them
 *
 */
const DIRECTIONS = [
    ['sw', 'w', 'nw'],
    ['s', null, 'n'],
    ['se', 'e', 'ne'],
];
const HANDLE_SIZE = 7;
const HANDLE_MARGIN = 3;

const enum XCoordinate {
    Left = 0,
    Center = 1,
    Right = 2,
}

const enum YCoordinate {
    Bottom = 0,
    Middle = 1,
    Top = 2,
}

const enum STEP {
    AllResize = 1,
    CornerResize = 2,
}

type ResizeContext = [XCoordinate, YCoordinate];

/**
 * @internal
 */
export default class ImageResizeHandler implements ImageHandler {
    private image: HTMLImageElement | null;
    private initWidth: number;
    private initHeight: number;
    private ratio: number;
    private resizeHelpers: ResizeHelper<ResizeContext>[];

    private angle: number;

    constructor(
        private editor: IEditor,
        private minWidth: number,
        private minHeight: number,
        private selectionBorderColor: string,
        private forcePreserveRatio: boolean
    ) {}

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

    removeTempAttributes(img: HTMLImageElement) {}

    private hideResizeHandles() {
        this.resizeHelpers?.forEach(helper => helper.dispose());
        this.resizeHelpers = [];

        const wrapper = this.getImageWrapper();
        if (wrapper) {
            this.removeWrappers(wrapper);
        }
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
        this.editor.select(wrapper, PositionType.After);

        const step = this.editor.isFeatureEnabled(ExperimentalFeatures.SingleDirectionResize)
            ? STEP.AllResize
            : STEP.CornerResize;
        this.resizeHelpers = [];
        const doc = this.editor.getDocument();

        for (let x: XCoordinate = XCoordinate.Left; x <= XCoordinate.Right; x += step) {
            for (let y: YCoordinate = YCoordinate.Bottom; y <= YCoordinate.Top; y += step) {
                const direction = DIRECTIONS[x][y];
                const html = direction
                    ? `<div style="position:absolute;${x == XCoordinate.Left ? 'left' : 'right'}:${
                          x == XCoordinate.Center ? '50%' : '0px'
                      };${y == YCoordinate.Top ? 'top' : 'bottom'}:${
                          y == YCoordinate.Middle ? '50%' : '0px'
                      }">
                    <div style="position:relative;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;background-color: ${
                          this.selectionBorderColor
                      };cursor:${direction}-resize;${
                          y == YCoordinate.Top ? 'top' : 'bottom'
                      }:-${HANDLE_MARGIN}px;${
                          x == XCoordinate.Left ? 'left' : 'right'
                      }:-${HANDLE_MARGIN}px"></div></div>`
                    : `<div style="position:absolute;left:0;right:0;top:0;bottom:0;border:solid 1px ${this.selectionBorderColor};pointer-events:none;">` +
                      `<div style="position:absolute;left:50%;top:-15px;height:15px;width:1px;background-color:${this.selectionBorderColor}">` +
                      `<div class="${ROTATE_HANDLE_CLASS}" style="border:solid 1px ${
                          this.selectionBorderColor
                      };background-color:${
                          this.editor.isDarkMode() ? '#333' : 'white'
                      };width:30px;height:30px;left:-15px;top:-30px;border-radius:50%;cursor:move;position:absolute;pointer-events:auto">` +
                      '<svg style="width:16px;height:16px;margin: 7px 7px">' +
                      `<path d="M 10.5,10.0 A 3.8,3.8 0 1 1 6.7,6.3" transform="matrix(1.1 1.1 -1.1 1.1 11.6 -10.8)" fill-opacity="0" stroke-width="1" stroke="${this.selectionBorderColor}" />` +
                      `<path d="M12.0 3.648l.884-.884.53 2.298-2.298-.53z" stroke="${this.selectionBorderColor}" /></svg></div></div></div>`;
                const div = fromHtml(html, doc)[0] as HTMLElement;
                wrapper.appendChild(div);

                this.resizeHelpers.push(
                    direction
                        ? new ResizeHelper(
                              div,
                              [x, y],
                              this.onResizeBegin,
                              this.onResize,
                              this.onResizeEnd
                          )
                        : new ResizeHelper(
                              div.querySelector('.' + ROTATE_HANDLE_CLASS),
                              [x, y],
                              this.onResizeBegin,
                              this.onRotate
                          )
                );
            }
        }
    }

    private onResizeBegin = () => {
        if (this.image) {
            this.editor.addUndoSnapshot();
            this.initWidth = this.image.clientWidth;
            this.initHeight = this.image.clientHeight;
            this.ratio =
                this.initWidth > 0 && this.initHeight > 0
                    ? (this.initWidth * 1.0) / this.initHeight
                    : 0;
            this.angle = 0;
        }
    };

    private onResize = ([x, y]: ResizeContext, deltaX: number, deltaY: number, e: MouseEvent) => {
        if (this.image) {
            const horizontalOnly = x == XCoordinate.Center;
            const verticalOnly = y == YCoordinate.Middle;
            const shouldPreserveRatio =
                !(horizontalOnly || verticalOnly) && (this.forcePreserveRatio || e.shiftKey);
            let newWidth = horizontalOnly
                ? this.initWidth
                : Math.max(
                      this.initWidth + deltaX * (x == XCoordinate.Left ? -1 : 1),
                      this.minWidth
                  );
            let newHeight = verticalOnly
                ? this.initHeight
                : Math.max(
                      this.initHeight + deltaY * (y == YCoordinate.Top ? -1 : 1),
                      this.minHeight
                  );

            if (shouldPreserveRatio && this.ratio > 0) {
                newHeight = Math.min(newHeight, newWidth / this.ratio);
                newWidth = Math.min(newWidth, newHeight * this.ratio);

                if (this.ratio > 0) {
                    if (newWidth < newHeight * this.ratio) {
                        newWidth = newHeight * this.ratio;
                    } else {
                        newHeight = newWidth / this.ratio;
                    }
                }
            }

            this.setSize(newWidth, newHeight);

            // double check
            if (shouldPreserveRatio && this.ratio > 0) {
                const clientWidth = Math.floor(this.image.clientWidth);
                const clientHeight = Math.floor(this.image.clientHeight);
                newWidth = Math.floor(newWidth);
                newHeight = Math.floor(newHeight);
                if (clientHeight !== newHeight || clientWidth !== newWidth) {
                    if (clientHeight < newHeight) {
                        newWidth = clientHeight * this.ratio;
                    } else {
                        newHeight = clientWidth / this.ratio;
                    }

                    this.setSize(newWidth, newHeight);
                }
            }
        }
    };

    private onResizeEnd = () => {
        if (this.image) {
            this.editor.addUndoSnapshot();
            this.editor.triggerContentChangedEvent(ChangeSource.ImageResize, this.image);
        }
    };

    private onRotate = (context: ResizeContext, deltaX: number, deltaY: number) => {
        const wrapper = this.getImageWrapper();

        if (wrapper) {
            const h = this.initHeight / 2 + 25;
            const newX = h * Math.sin(this.angle) + deltaX;
            const newY = h * Math.cos(this.angle) - deltaY;
            const deg = (Math.atan2(newX, newY) / Math.PI) * 180;

            wrapper.style.transform = `rotate(${deg}deg)`;
        }
    };

    private setSize(width: number, height: number) {
        this.image.style.width = width + 'px';
        this.image.style.height = height + 'px';
        this.image.width = width;
        this.image.height = height;
    }
}
