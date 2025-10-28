import { Heritage, __ENUMS } from '../models/Heritage.js';
import { validateCreate, pickUpdatable } from '../validators/heritage.validator.js';
import { publicUrl } from '../middlewares/upload.js';

const TYPE_MAP = { di_san_van_hoa_vat_the:1, di_san_van_hoa_phi_vat_the:2, di_san_thien_nhien:3 };
const LEVEL_MAP = { cap_tinh:1, cap_quoc_gia:2, cap_dac_biet:3, di_san_the_gioi:4, ds_phi_vat_the_dai_dien:5, ky_uc_the_gioi:6, khu_du_tru_sinh_quyen:7, cong_vien_dia_chat_toan_cau:8 };

function normalizeImageValue(val, req) {
  if (!val && val !== '') return undefined;
  // val may be an object from multer (with filename) or a filename string or a full URL
  if (typeof val === 'object') {
    if (val.filename) return publicUrl(val.filename);
    if (val.path) return publicUrl(require('path').basename(val.path));
    return undefined;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/') || s.startsWith('uploads/')) return s.startsWith('/') ? s : `/${s}`;
    // plain filename -> make public url
    if (/^[\w\-.]+\.[A-Za-z0-9]{2,6}$/.test(s)) return publicUrl(s);
    // otherwise return as-is
    return s;
  }
  return undefined;
}

function sanitize(body) {
  // convert "" -> undefined để validator bỏ qua
  for (const k in body) if (body[k] === '') body[k] = undefined;
  // nếu thiếu protocol cho wiki_link thì thêm https://
  if (body.wiki_link && !/^https?:\/\//i.test(body.wiki_link)) {
    body.wiki_link = `https://${body.wiki_link}`;
  }
}
 export async function createHeritage(req, res) {
  try {
    const body = { ...req.body };

    // map code từ type/level
    if (body.type) body.type_code = TYPE_MAP[body.type];
    if (body.level) body.code_level = LEVEL_MAP[body.level];

    // map file -> URL (robust: accept multer objects, filenames or urls)
    if (req.files?.img?.[0]) {
      body.img = normalizeImageValue(req.files.img[0], req);
    } else if (body.img) {
      body.img = normalizeImageValue(body.img, req);
    }
    if (req.files?.photo_library?.length) {
      body.photo_library = req.files.photo_library.map(f => normalizeImageValue(f, req)).filter(Boolean);
    } else if (body.photo_library) {
      // might be sent as JSON string or array
      let arr = body.photo_library;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = [arr]; }
      }
      if (Array.isArray(arr)) {
        body.photo_library = arr.map(v => normalizeImageValue(v, req)).filter(Boolean);
      } else {
        body.photo_library = [normalizeImageValue(arr, req)].filter(Boolean);
      }
    }

    // parse JSON nếu có
    if (typeof body.coordinate === 'string' && body.coordinate.trim()) {
      try { body.coordinate = JSON.parse(body.coordinate); } catch {}
    }
    if (typeof body.tags === 'string' && body.tags.trim()) {
      try { body.tags = JSON.parse(body.tags); } catch {}
    }

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
    const update = { ...req.body }; // Dữ liệu text từ form

    // Map code từ type/level (nếu có)
    if (update.type) update.type_code = TYPE_MAP[update.type];
    if (update.level) update.code_level = LEVEL_MAP[update.level];

    // --- Xử lý Ảnh chính (img) ---
    // Ưu tiên file mới tải lên
    if (req.files?.img?.[0]) {
      update.img = normalizeImageValue(req.files.img[0], req);
    }
    // Nếu không có file mới, kiểm tra xem client có gửi giá trị text không
    // (có thể là URL cũ hoặc bị xóa -> "")
    else if ('img' in req.body) {
         // Nếu gửi "" -> xóa ảnh, nếu gửi URL -> giữ nguyên, nếu không gửi -> không đổi
         update.img = normalizeImageValue(req.body.img, req) || null; // Dùng null nếu muốn xóa hẳn
    }

    // --- Xử lý Thư viện ảnh (photo_library) ---
    let keptPhotos = [];
    // 1. Lấy danh sách ảnh cũ cần giữ lại từ hidden input (gửi dạng JSON string)
    if (req.body.photo_library && typeof req.body.photo_library === 'string') {
      try {
        const parsedKept = JSON.parse(req.body.photo_library);
        if (Array.isArray(parsedKept)) {
          // Chuẩn hóa lại các URL/path cũ này (phòng trường hợp)
          keptPhotos = parsedKept.map(p => normalizeImageValue(p, req)).filter(Boolean);
        }
      } catch (e) {
        console.error("Lỗi parse JSON photo_library:", e);
        // Có thể bỏ qua hoặc báo lỗi tùy logic
      }
    }

    // 2. Lấy danh sách ảnh MỚI tải lên từ multer
    const addedPhotos = (req.files?.photo_library || [])
                          .map(f => normalizeImageValue(f, req))
                          .filter(Boolean);

    // 3. Kết hợp ảnh cũ (đã lọc) và ảnh mới
    // Chỉ cập nhật photo_library nếu có ảnh mới hoặc danh sách ảnh cũ thay đổi
    if (addedPhotos.length > 0 || req.body.photo_library) {
         update.photo_library = [...keptPhotos, ...addedPhotos];
    } else {
        // Nếu không có ảnh mới và không có thông tin ảnh cũ gửi lên,
        // thì không cập nhật photo_library (giữ nguyên giá trị cũ trong DB)
        delete update.photo_library;
    }


    // (Tuỳ chọn) Sanitize các trường khác nếu cần
    // sanitize(update);

    // Thực hiện cập nhật
    const item = await Heritage.findOneAndUpdate({ hid }, update, { new: true, runValidators: true });

    if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(item); // Trả về di sản đã cập nhật
  } catch (e) {
    console.error("Lỗi updateHeritage:", e); // Log lỗi chi tiết
    res.status(500).json({ error: e.message }); // Dùng 500 cho lỗi server
  }
}

// GET /api/heritages?q=&district_codename=&type_code=&code_level=&near=lat,lng&radiusKm=5&page=&limit=
export async function listHeritages(req, res) {
  try {
    const { q, district_codename, type_code, code_level, near, radiusKm } = req.query;
    const filter = {};

    if (district_codename) filter.district_codename = district_codename;
    if (type_code) filter.type_code = Number(type_code);
    if (code_level) filter.code_level = Number(code_level);

    // text search
    if (q) filter.$text = { $search: q };

    // near by (Geo)
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
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
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

 
// heritage.controller.js

export async function deleteHeritage(req, res) {
  console.log('>>> [DELETE] Đã nhận request xóa hid:', req.params.hid);
  
  try { // <--- THÊM DÒNG NÀY
    const { hid } = req.params;
    const r = await Heritage.deleteOne({ hid });

    if (r.deletedCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    
    res.json({ ok: true });

  } catch (e) { // <--- THÊM DÒNG NÀY
    // Báo lỗi 500 (Server Error) thay vì làm sập server
    console.error('LỖI KHI XÓA HERITAGE:', e.message);
    res.status(500).json({ error: e.message });
  } // <--- THÊM DÒNG NÀY
}

export async function enums(req, res) {
  res.json(__ENUMS);
}
