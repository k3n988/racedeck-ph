export const RACE_KIT_DELIVERY_OPTION = 'Race Kit Delivery';
export const RACE_KIT_CLAIMING_ITEM = 'Race Kit Claiming';
export const MAX_RACE_KIT_PICKUP_LOCATIONS = 40;
export const MAX_RACE_KIT_PRODUCT_VARIANTS = 40;
export const MAX_RACE_KIT_PRODUCT_IMAGES = 8;
export const MAX_RACE_KIT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_RACE_KIT_ITEM_DESCRIPTION_LENGTH = 1000;

export function isValidRaceKitImage(file: File) {
  return file.size > 0 && file.size <= MAX_RACE_KIT_IMAGE_BYTES &&
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}
