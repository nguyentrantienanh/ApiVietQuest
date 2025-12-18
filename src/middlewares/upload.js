
import 'dotenv/config'; // đảm bảo ENV có trước khi config Cloudinary

import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// (giữ nếu bạn vẫn cần phục vụ static /uploads cho code cũ)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Cấu hình Cloudinary từ ENV
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,       
  api_secret: process.env.CLOUDINARY_API_SECRET, 
});

// 2) Storage Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vietquest_img',
    format: async () => 'jpg',                 
    public_id: (req, file) => `${Date.now()}`, 
  },
});

// 3) Multer
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },  
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/i.test(file.mimetype)) {
      return cb(new Error('Chỉ cho phép file ảnh (png, jpg, jpeg, webp, svg).'));
    }
    cb(null, true);
  },
});

// dùng cho heritage: 1 ảnh chính + nhiều ảnh phụ
export const uploadHeritageImages = upload.fields([
  { name: 'img', maxCount: 1 },
  { name: 'photo_library', maxCount: 20 },
]);

// Trả URL public (Cloudinary đã cho https)
export function publicUrl(filenameOrUrl) {
  if (typeof filenameOrUrl === 'string' && /^https?:\/\//i.test(filenameOrUrl)) {
    return filenameOrUrl;
  }
  return filenameOrUrl; // fallback
}

// Giữ để tương thích code cũ (local uploads) — nếu còn dùng
export function toPublicUrl(req, filename) {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/images/${filename}`;
}

// ✅ Single upload cho avatar user — field: "avatar"
export const uploadUserAvatar = upload.single('avatar');
