// ============================================================================
// 設定您的 GitHub 圖庫 (Image Pool)
// 1. 確保你的 Repo 是 Public (公開) 的
// 2. 找出圖片的 Raw 網址前綴
// ============================================================================

// 🔴 修改這裡：把你原本的 'assets/' 改成 GitHub 的 Raw 網址前綴
// 格式通常是: https://raw.githubusercontent.com/[你的帳號]/[你的Repo名稱]/[分支名稱]/[資料夾路徑]/
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/EricLiu/SeoulTrip/main/public/'; 

const MY_TRAVEL_PHOTOS = [
  'seoul_1.jpg',
  'seoul_2.jpg',
  'seoul_3.jpg',
  'seoul_4.jpg',
  'seoul_5.jpg',
  // 記得：每次上傳新照片到 Github，都要來這裡加檔名
];

/**
 * 隨機從 GitHub 圖庫中選一張照片
 */
export const getRandomImage = (): string => {
  if (MY_TRAVEL_PHOTOS.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * MY_TRAVEL_PHOTOS.length);
  return `${GITHUB_BASE_URL}${MY_TRAVEL_PHOTOS[randomIndex]}`;
};
