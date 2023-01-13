import formatImageWithContentModel from './formatImageWithContentModel';
import { ContentModelImage } from '../../publicTypes/segment/ContentModelImage';
import { IExperimentalContentModelEditor } from '../../publicTypes/IExperimentalContentModelEditor';
import { readFile } from 'roosterjs-editor-dom';

/**
 * Set border color to an image
 * @param editor The editor instance
 * @param color of the border
 */
export default function changeImage(editor: IExperimentalContentModelEditor, file: File) {
    readFile(file, dataUrl => {
        if (dataUrl && !editor.isDisposed()) {
            formatImageWithContentModel(
                editor,
                (image: ContentModelImage) => {
                    image.src = dataUrl;
                },
                'changeImage'
            );
        }
    });
}
