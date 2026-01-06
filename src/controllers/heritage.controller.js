
import { Heritage, __ENUMS } from '../models/Heritage.js';
import { validateCreate } from '../validators/heritage.validator.js';
import { publicUrl } from '../middlewares/upload.js';
import path from 'path';

const TYPE_MAP = {
  di_san_van_hoa_vat_the: 1,
  di_san_van_hoa_phi_vat_the: 2,
  di_san_thien_nhien: 3
};
const LEVEL_MAP = {
  cap_tinh: 1,
  cap_quoc_gia: 2,
  cap_dac_biet: 3,
  di_san_the_gioi: 4,
  ds_phi_vat_the_dai_dien: 5,
  ky_uc_the_gioi: 6,
  khu_du_tru_sinh_quyen: 7,
  cong_vien_dia_chat_toan_cau: 8
};

function normalizeImageValue(val, req) {
  if (!val && val !== '') return undefined;

  // 1. Trường hợp là File Object (Multer/Cloudinary upload)
  if (typeof val === 'object' && val.path) {
    const s = String(val.path);
    if (s.startsWith('http')) return s;
    if (val.filename) {
      const cloud = process.env.CLOUDINARY_CLOUD_NAME;
      const fmt = val.format || 'jpg';
      return `https://res.cloudinary.com/${cloud}/image/upload/${val.filename}.${fmt}`;
    }
    return s;
  }
  
  // 2. Trường hợp là Object có sẵn (Dữ liệu cũ hoặc JSON gửi lên)
  if (typeof val === 'object') {
     if (val.secure_url) return val.secure_url; // Cloudinary raw
     if (val.url) return val.url; // Đã là object đúng form
     return undefined;
  }

  // 3. Trường hợp là String (URL)
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s; 
    return s; 
  }
  return undefined;
}

function sanitize(body) {
  for (const k in body) if (body[k] === '') body[k] = undefined;
  if (body.wiki_link && !/^https?:\/\//i.test(body.wiki_link)) {
    body.wiki_link = `https://${body.wiki_link}`;
  }
}

/** Trích xuất GeoJSON từ link Google Maps */
function extractCoordinates(url) {
  if (!url || typeof url !== 'string') return null;

  // Pattern 1: /@lat,lng,z/
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+z)/);

  // Pattern 2: q=lat,lng
  if (!match) match = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);

  if (match && match.length >= 3) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { type: 'Point', coordinates: [lng, lat] }; 
  }
  return null;
}

export async function createHeritage(req, res) {
  try {
    const body = { ...req.body };

    if (body.type) body.type_code = TYPE_MAP[body.type];
    if (body.level) body.code_level = LEVEL_MAP[body.level];

    // --- [SỬA] Xử lý Ảnh chính (img) ---
    // Ưu tiên file upload, nếu không có thì lấy link từ body
    const imgFile = req.files?.img?.[0];
    const imgUrl = normalizeImageValue(imgFile || body.img, req);

    if (imgUrl) {
      body.img = {
        url: imgUrl,
        // Lấy credit/caption từ body (Frontend phải gửi thêm 2 trường này)
        credit: body.img_credit || '', 
        caption: body.img_caption || ''
      };
    } else {
      body.img = null;
    }

    // --- [SỬA] Xử lý Thư viện ảnh (photo_library) ---
    let finalPhotoLib = [];

    // 1. Xử lý ảnh cũ hoặc ảnh dạng JSON (Object có sẵn)
    if (body.photo_library) {
      let arr = body.photo_library;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = []; } // Nếu lỗi thì bỏ qua
      }
      if (!Array.isArray(arr)) arr = [arr];

      // Duyệt qua mảng JSON gửi lên
      arr.forEach(item => {
        // Nếu item là object {url, credit} thì giữ nguyên
        if (typeof item === 'object' && item.url) {
          finalPhotoLib.push({
            url: item.url,
            credit: item.credit || '',
            caption: item.caption || ''
          });
        } 
        // Nếu item là string URL thì convert sang object
        else {
          const url = normalizeImageValue(item, req);
          if (url) finalPhotoLib.push({ url, credit: '', caption: '' });
        }
      });
    }

    // 2. Xử lý ảnh mới upload (req.files)
    if (req.files?.photo_library?.length) {
      req.files.photo_library.forEach(f => {
        const url = normalizeImageValue(f, req);
        if (url) {
          // Ảnh mới upload tạm thời để credit rỗng (hoặc anh có thể xử lý logic mảng credit tương ứng)
          finalPhotoLib.push({ url, credit: '', caption: '' });
        }
      });
    }
    
    body.photo_library = finalPhotoLib;

    // ... (Phần xử lý Google Maps và GeoJSON giữ nguyên) ...
    if (body.google_map_link) {
      const geoJson = extractCoordinates(body.google_map_link);
      body.coordinate = geoJson || undefined;
    } else if (body.google_map_link === '') {
      body.coordinate = undefined;
    }

    if (typeof body.coordinate === 'string' && body.coordinate.trim()) { try { body.coordinate = JSON.parse(body.coordinate); } catch {} }
    if (typeof body.tags === 'string' && body.tags.trim()) { try { body.tags = JSON.parse(body.tags); } catch {} }

    sanitize(body);

    const err = validateCreate(body);
    if (err) return res.status(400).json({ error: err });

    const data = await Heritage.create(body);
    return res.status(201).json({ message: '✅ Đã thêm', data });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'hid đã tồn tại' });
    res.status(400).json({ error: e.message });
  }
}

export async function updateHeritage(req, res) {
  try {
    const { hid } = req.params;
    const update = { ...req.body };

    if (update.type) update.type_code = TYPE_MAP[update.type];
    if (update.level) update.code_level = LEVEL_MAP[update.level];

    // --- [SỬA] Ảnh chính ---
    if (req.files?.img?.[0]) {
      // Có file mới upload -> Thay thế hoàn toàn
      const url = normalizeImageValue(req.files.img[0], req);
      update.img = {
        url: url,
        credit: update.img_credit || '',
        caption: update.img_caption || ''
      };
    } else if ('img' in req.body) {
        // Không upload file, client gửi string link hoặc object
        // Trường hợp 1: Client muốn xóa ảnh (gửi chuỗi rỗng)
        if (update.img === '' || update.img === null) {
            update.img = null;
        } 
        // Trường hợp 2: Client gửi Object {url, credit} (JSON string)
        else if (typeof update.img === 'string') {
            try {
                const parsed = JSON.parse(update.img);
                if (parsed.url) update.img = parsed; // Lấy object
                else update.img = { url: parsed, credit: update.img_credit || '' }; // Fallback
            } catch {
                // Là URL string thường
                const url = normalizeImageValue(update.img, req);
                if (url) update.img = { url, credit: update.img_credit || '' };
            }
        }
    }
    // Chú ý: Nếu client chỉ muốn update credit mà không đổi ảnh, họ phải gửi cả `img` (URL cũ) và `img_credit` mới.

    // --- [SỬA] Thư viện ảnh ---
    let finalPhotoLib = [];

    // 1. Ảnh cũ giữ lại (Client gửi JSON string mảng các object)
    if (update.photo_library) {
      let arr = update.photo_library;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = []; }
      }
      if (!Array.isArray(arr)) arr = [arr];

      arr.forEach(item => {
        // Logic: Nếu item có url và credit -> giữ nguyên. Nếu chỉ là url -> thêm credit rỗng
        if (item && typeof item === 'object' && item.url) {
            finalPhotoLib.push({
                url: item.url,
                credit: item.credit || '',
                caption: item.caption || ''
            });
        } else {
            const url = normalizeImageValue(item, req);
            if (url) finalPhotoLib.push({ url, credit: '', caption: '' });
        }
      });
    }

    // 2. Ảnh mới upload thêm
    if (req.files?.photo_library?.length) {
      req.files.photo_library.forEach(f => {
        const url = normalizeImageValue(f, req);
        if (url) finalPhotoLib.push({ url, credit: '', caption: '' });
      });
    }

    if (finalPhotoLib.length > 0) {
        update.photo_library = finalPhotoLib;
    } else if ('photo_library' in req.body && (!req.files?.photo_library)) {
        // Nếu client gửi photo_library rỗng và không up file -> Xóa hết
        update.photo_library = []; 
    }

    // ... (Phần Maps và Update DB giữ nguyên) ...
    if (update.google_map_link || update.google_map_link === '') {
      const geoJson = extractCoordinates(update.google_map_link);
      if (geoJson) {
        update.coordinate = geoJson;
      } else if (update.google_map_link === '') {
        update.coordinate = undefined;
        update.google_map_link = null;
      }
    }

    const item = await Heritage.findOneAndUpdate({ hid }, update, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(item);
  } catch (e) {
    console.error('Lỗi updateHeritage:', e);
    res.status(500).json({ error: e.message || 'Lỗi server khi cập nhật' });
  }
}

// GET /api/heritages?q=&ward_codename=&type_code=&code_level=&near=lat,lng&radiusKm=5&page=&limit=
export async function listHeritages(req, res) {
  try {
    const { q, ward_codename, type_code, code_level, near, radiusKm } = req.query;
    const filter = {};

    if (ward_codename) filter.ward_codename = ward_codename;
    if (type_code) filter.type_code = Number(type_code);
    if (code_level) filter.code_level = Number(code_level);

    if (q) filter.$text = { $search: q };

    if (near) {
      const [latStr, lngStr] = near.split(',').map(s => s.trim());
      const lat = Number(latStr), lng = Number(lngStr);
      const km = Number(radiusKm || 5);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'near phải dạng "lat,lng"' });
      }
      filter.coordinate = {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: km * 1000
        }
      };
    }

    const sort = req.query.sort || '-createdAt';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '1000000', 10), 1), 1000000);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Heritage.find(filter).sort(sort).skip(skip).limit(limit),
      Heritage.countDocuments(filter)
    ]);

    res.json({ items, total, page, limit, hasMore: skip + items.length < total });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function getHeritage(req, res) {
  const { hid } = req.params;
  const item = await Heritage.findOne({ hid });
  if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json(item);
}

export async function deleteHeritage(req, res) {
  console.log('>>> [DELETE] Đã nhận request xóa hid:', req.params.hid);
  try {
    const { hid } = req.params;
    const r = await Heritage.deleteOne({ hid });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ok: true });
  } catch (e) {
    console.error('LỖI KHI XÓA HERITAGE:', e.message);
    res.status(500).json({ error: e.message });
  }
}

export async function enums(req, res) {
  res.json(__ENUMS);
}
