const CROP_INFO_DATASET = 'cropInfo';

export interface CropInfo {
    src: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export function storeCropInfo(img: HTMLImageElement, info: CropInfo) {
    if (info.bottom == 0 && info.right == 0 && info.top == 0 && info.bottom == 0) {
        removeCropInfo(img);
    } else {
        img.dataset[CROP_INFO_DATASET] = JSON.stringify(info);
    }
}

export function extractCropInfo(img: HTMLImageElement): CropInfo {
    let cropInfo: CropInfo = null;
    try {
        cropInfo = JSON.parse(img.dataset[CROP_INFO_DATASET]) as CropInfo;
    } catch {}

    if (
        cropInfo &&
        cropInfo.src &&
        isNumber(cropInfo.left) &&
        isNumber(cropInfo.right) &&
        isNumber(cropInfo.top) &&
        isNumber(cropInfo.bottom)
    ) {
        return cropInfo;
    } else {
        return {
            src: img.src,
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        };
    }
}

export function removeCropInfo(img: HTMLImageElement) {
    delete img.dataset[CROP_INFO_DATASET];
}

function isNumber(o: any): o is number {
    return typeof o === 'number';
}
