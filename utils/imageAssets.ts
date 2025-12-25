
// ============================================================================
// 設定您的圖庫 (Image Pool)
// 1. 在專案根目錄建立一個資料夾叫做 "assets" (或直接放在根目錄)
// 2. 將您的照片上傳進去
// 3. 在下方的 ARRAY 中填入檔名
// ============================================================================

const LOCAl_IMAGE_PATH = 'assets/'; // 如果照片放在 assets 資料夾內，請保留此設定。若放在根目錄，請改為 ''

const MY_TRAVEL_PHOTOS = [
  'seoul_1.jpg',
  'seoul_2.jpg',
  'seoul_3.jpg',
  'cafe_vibes.jpg',
  'street_food.jpg',
  'palace.jpg',
  // 您可以繼續往下新增更多照片檔名...
];

/**
 * 隨機從圖庫中選一張照片
 * Returns a formatted path (e.g., "assets/seoul_1.jpg")
 */
export const getRandomImage = (): string => {
  if (MY_TRAVEL_PHOTOS.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * MY_TRAVEL_PHOTOS.length);
  return `${LOCAl_IMAGE_PATH}${MY_TRAVEL_PHOTOS[randomIndex]}`;
};
