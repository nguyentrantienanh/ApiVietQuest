import { Router } from 'express';
import { uploadHeritageImages, publicUrl } from '../middlewares/upload.js';
import { Heritage } from '../models/Heritage.js';
import { typeLabel, levelLabel } from '../utils/labels.js';
import { validateCreate } from '../validators/heritage.validator.js';

const r = Router();

const TYPE_TO_CODE = {
  di_san_van_hoa_vat_the: 1,
  di_san_van_hoa_phi_vat_the: 2,
  di_san_thien_nhien: 3,
};
const LEVEL_TO_CODE = {
  cap_tinh: 1,
  cap_quoc_gia: 2,
  cap_dac_biet: 3,
  di_san_the_gioi: 4,
  ds_phi_vat_the_dai_dien: 5,
  ky_uc_the_gioi: 6,
  khu_du_tru_sinh_quyen: 7,
  cong_vien_dia_chat_toan_cau: 8,
};

function normalizeImageValue(req, val) {
  if (!val && val !== '') return undefined;
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
    if (/^[\w\-.]+\.[A-Za-z0-9]{2,6}$/.test(s)) return publicUrl(s);
    return s;
  }
  return undefined;
}

// GET: hiển thị form
r.get('/heritages/new', (req, res) => {
  res.render('heritages', { message: null });
});

// POST: nhận form và lưu vào Mongo
r.post('/heritages/new', uploadHeritageImages, async (req, res) => {
  try {
    const body = { ...req.body };

    // ⚠️ BẮT BUỘC trong form phải có: hid, ward_codename, name, type, level
    // Map code từ type/level
    const typeKey = body.type;   // ví dụ 'di_san_van_hoa_vat_the'
    const levelKey = body.level; // ví dụ 'cap_quoc_gia'

    body.type_code = TYPE_TO_CODE[typeKey];
    body.code_level = LEVEL_TO_CODE[levelKey];

    if (!body.type_code || !body.code_level) {
      return res.render('heritages', { message: '❌ Loại hoặc Cấp bậc không hợp lệ.' });
    }

    // Ảnh chính (1 file) → body.img
    if (req.files?.img?.[0]) {
      body.img = normalizeImageValue(req, req.files.img[0]);
    } else if (body.img) {
      body.img = normalizeImageValue(req, body.img);
    }

    // Thư viện ảnh (nhiều file) → body.photo_library[]
    if (req.files?.photo_library?.length) {
      body.photo_library = req.files.photo_library.map((f) => normalizeImageValue(req, f)).filter(Boolean);
    } else if (body.photo_library) {
      let arr = body.photo_library;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = [arr]; }
      }
      if (Array.isArray(arr)) body.photo_library = arr.map(v => normalizeImageValue(req, v)).filter(Boolean);
      else body.photo_library = [normalizeImageValue(req, arr)].filter(Boolean);
    }

    // (tuỳ chọn) parse coordinate nếu form gửi JSON string
    if (typeof body.coordinate === 'string' && body.coordinate.trim()) {
      try { body.coordinate = JSON.parse(body.coordinate); } catch {}
    }

    // Validate & lưu
    const err = validateCreate(body);
    if (err) return res.render('heritages', { message: `❌ ${err}` });

    const created = await Heritage.create(body);
    return res.render('heritages', { message: `✅ Đã thêm: ${created.name}` });
  } catch (e) {
    return res.render('heritages', { message: `❌ Lỗi: ${e.message}` });
  }
});

// LIST: show paginated list + gallery
r.get('/heritages', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '1000000', 10), 1), 1000000);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Heritage.find({}).sort('-createdAt').skip(skip).limit(limit),
      Heritage.countDocuments({})
    ]);
    // inject readable labels for templates
    const itemsWithLabels = items.map(it => ({
      ...it.toObject ? it.toObject() : it,
      typeLabel: typeLabel(it.type),
      levelLabel: levelLabel(it.level)
    }));
    res.render('heritages_list', { items: itemsWithLabels, total, page, limit, hasMore: skip + items.length < total, message: null });
  } catch (e) {
    res.render('heritages_list', { items: [], total: 0, page:1, limit:20, hasMore:false, message: `Lỗi: ${e.message}` });
  }
});

// GET edit form
r.get('/heritages/:hid/edit', async (req, res) => {
  try {
    const { hid } = req.params;
  const item = await Heritage.findOne({ hid });
  if (!item) return res.redirect('/heritages');
  const itemObj = item.toObject ? item.toObject() : item;
  itemObj.typeLabel = typeLabel(itemObj.type);
  itemObj.levelLabel = levelLabel(itemObj.level);
  res.render('heritage_edit', { item: itemObj, message: null });
  } catch (e) {
    res.redirect('/heritages');
  }
});

// POST edit (handle uploads)
r.post('/heritages/:hid/edit', uploadHeritageImages, async (req, res) => {
  try {
    const { hid } = req.params;
    const update = { ...req.body };
    // map code
    if (update.type) update.type_code = TYPE_TO_CODE[update.type];
    if (update.level) update.code_level = LEVEL_TO_CODE[update.level];
    if (req.files?.img?.[0]) update.img = normalizeImageValue(req, req.files.img[0]);
    if (req.files?.photo_library?.length) {
      const current = (await Heritage.findOne({ hid }))?.photo_library || [];
      const added = req.files.photo_library.map(f => normalizeImageValue(req, f)).filter(Boolean);
      update.photo_library = [ ...current, ...added ];
    }
    // parse JSON-like fields
    if (typeof update.tags === 'string' && update.tags.trim()) {
      try { update.tags = JSON.parse(update.tags); } catch (err) {}
    }
    await Heritage.findOneAndUpdate({ hid }, update, { new: true, runValidators: true });
    res.redirect('/heritages');
  } catch (e) {
    const item = await Heritage.findOne({ hid: req.params.hid });
    res.render('heritage_edit', { item, message: `Lỗi: ${e.message}` });
  }
});

// POST delete
r.post('/heritages/:hid/delete', async (req, res) => {
  try {
    const { hid } = req.params;
    await Heritage.deleteOne({ hid });
    res.redirect('/heritages');
  } catch (e) {
    res.redirect('/heritages');
  }
});

export default r;
