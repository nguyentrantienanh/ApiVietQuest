// controllers/heritage.controller.js
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

/** Trả về URL ảnh hợp lệ từ object (multer+cloudinary) hoặc string */
function normalizeImageValue(val, req) {
  if (!val && val !== '') return undefined;

  if (typeof val === 'object') {
    // CloudinaryStorage thường trả:
    // - secure_url (https) (ưu tiên)
    // - url
    // - path (nhiều phiên bản map URL vào path)
    // - filename, format
    if (val.secure_url) return val.secure_url;
    if (val.url) return val.url;
    if (val.path) {
      const s = String(val.path);
      if (s.startsWith('http')) return s;
      if (val.filename) {
        const cloud = process.env.CLOUDINARY_CLOUD_NAME;
        const fmt = val.format || 'jpg';
        return `https://res.cloudinary.com/${cloud}/image/upload/${val.filename}.${fmt}`;
      }
      return s;
    }
    return undefined;
  }

  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s; // URL cũ/Cloudinary -> giữ nguyên
    return s; // nếu còn path local, tuỳ bạn có còn phục vụ static hay không
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
    return { type: 'Point', coordinates: [lng, lat] }; // GeoJSON: [lng, lat]
  }
  return null;
}

export async function createHeritage(req, res) {
  try {
    const body = { ...req.body };

    if (body.type) body.type_code = TYPE_MAP[body.type];
    if (body.level) body.code_level = LEVEL_MAP[body.level];

    // Ảnh chính
    if (req.files?.img?.[0]) body.img = normalizeImageValue(req.files.img[0], req);
    else if (body.img) body.img = normalizeImageValue(body.img, req);

    // Thư viện ảnh
    if (req.files?.photo_library?.length) {
      body.photo_library = req.files.photo_library.map(f => normalizeImageValue(f, req)).filter(Boolean);
    } else if (body.photo_library) {
      let arr = body.photo_library;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = [arr]; }
      }
      if (Array.isArray(arr)) body.photo_library = arr.map(v => normalizeImageValue(v, req)).filter(Boolean);
      else body.photo_library = [normalizeImageValue(arr, req)].filter(Boolean);
    }

    // Google Maps link -> GeoJSON
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

    // Ảnh chính
    if (req.files?.img?.[0]) {
      update.img = normalizeImageValue(req.files.img[0], req);
    } else if ('img' in req.body) {
      // Cho phép xóa ảnh chính khi client gửi img=""
      update.img = normalizeImageValue(req.body.img, req);
      if (update.img === undefined) update.img = null;
    }

    // Thư viện ảnh: giữ cũ + thêm mới
    let keptPhotos = [];
    if (update.photo_library && typeof update.photo_library === 'string') {
      try {
        const parsed = JSON.parse(update.photo_library);
        if (Array.isArray(parsed)) keptPhotos = parsed.map(p => normalizeImageValue(p, req)).filter(Boolean);
        else keptPhotos = [normalizeImageValue(parsed, req)].filter(Boolean);
      } catch {
        keptPhotos = [normalizeImageValue(update.photo_library, req)].filter(Boolean);
      }
    }
    const addedPhotos = (req.files?.photo_library || []).map(f => normalizeImageValue(f, req)).filter(Boolean);
    if (addedPhotos.length > 0 || update.photo_library) {
      update.photo_library = [...keptPhotos, ...addedPhotos];
    } else {
      delete update.photo_library;
    }

    // Google Maps link -> GeoJSON
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
