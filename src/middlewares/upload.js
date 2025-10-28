import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../uploads/images');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  },
});

export const upload = multer({ storage });

// dùng cho heritage: 1 ảnh chính + nhiều ảnh phụ
export const uploadHeritageImages = upload.fields([
  { name: 'img', maxCount: 1 },
  { name: 'photo_library', maxCount: 20 },
]);

export function toPublicUrl(req, filename) {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/images/${filename}`;
}

// Build an absolute public URL server-side (doesn't require a request)
export function publicUrl(filename) {
  const port = process.env.PORT || '4000';
  const base = process.env.BASE_URL || `http://localhost:${port}`;
  return `${base}/uploads/images/${filename}`;
}
export const uploadUserAvatar = upload.single('avatar');