import isContentModelEditor from '../../editor/isContentModelEditor';
import { changeImage } from 'roosterjs-content-model';
import { createElement } from 'roosterjs-editor-dom';
import { CreateElementData } from 'roosterjs-editor-types';
import { RibbonButton } from 'roosterjs-react';

const FileInput: CreateElementData = {
    tag: 'input',
    attributes: {
        type: 'file',
        accept: 'image/*',
        display: 'none',
    },
};

/**
 * @internal
 * "Align center" button on the format ribbon
 */
export const insertNewImage: RibbonButton<'buttonNameChangeImage'> = {
    key: 'buttonNameChangeImage',
    unlocalizedText: 'Change Image',
    iconName: 'Photo2',
    isChecked: formatState => !formatState.isImageSelected,
    onClick: editor => {
        if (isContentModelEditor(editor)) {
            const document = editor.getDocument();
            const fileInput = createElement(FileInput, document) as HTMLInputElement;
            document.body.appendChild(fileInput);

            fileInput.addEventListener('change', () => {
                if (fileInput.files) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        changeImage(editor, fileInput.files[i]);
                    }
                }
            });

            try {
                fileInput.click();
            } finally {
                document.body.removeChild(fileInput);
            }
        }
    },
};
