import mongoose from 'mongoose';
import isURL from 'validator/lib/isURL.js';

const TYPE_ENUM = [
  'di_san_van_hoa_vat_the',
  'di_san_van_hoa_phi_vat_the',
  'di_san_thien_nhien'
];

const LEVEL_ENUM = [
  // Trong nước
  'cap_tinh',
  'cap_quoc_gia',
  'cap_dac_biet',
  // Thế giới (UNESCO)
  'di_san_the_gioi',
  'ds_phi_vat_the_dai_dien',
  'ky_uc_the_gioi',
  'khu_du_tru_sinh_quyen',
  'cong_vien_dia_chat_toan_cau'
];

// --- [MỚI] Schema con cho Ảnh (để lưu nguồn/credit) ---
const HeritageImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    validate: {
      validator: (v) => {
        if (!v) return true;
        if (typeof v !== 'string') return false;
        // Logic validate cũ của bạn:
        // allow absolute URLs with protocol OR server-relative paths OR plain filenames
        // Accept localhost/IP URLs by allowing no-TLD in the URL check
        if (isURL(v, { require_protocol: true, require_tld: false })) return true;
        if (v.startsWith('/') || v.startsWith('uploads/')) return true;
        // plain filename like "1691234-uuid.jpg"
        if (/^[\w\-.]+\.[A-Za-z0-9]{2,6}$/.test(v)) return true;
        return false;
      },
      message: 'Image URL must be a valid URL, server-relative path, or filename'
    }
  },
  credit: { type: String, trim: true, default: '' }, // Nơi lưu nguồn: "Nguyễn Văn A / WikiCommons"
  caption: { type: String, trim: true, default: '' } // Chú thích ảnh (nếu cần)
}, { _id: false }); // _id: false để không tạo ID thừa cho sub-document này


const HeritageSchema = new mongoose.Schema(
  {
    // id tuỳ bạn muốn, để rõ ràng ta tạo 'hid' (string) làm mã riêng, không đụng _id của Mongo
    hid: { type: String, required: true, unique: true, index: true },

    // Liên kết đơn vị hành chính (từ provinces.open-api.vn)
    ward_codename: { type: String, required: true, index: true }, // ví dụ: "phuong_phuoc_my"

    name: { type: String, required: true, trim: true },

    // Loại di sản & code
    type: { type: String, enum: TYPE_ENUM, required: true },
    type_code: { type: Number, enum: [1, 2, 3], required: true },

    // Wiki
    wiki_link: {
      type: String,
      validate: {
        validator: (v) => !v || isURL(v, { require_protocol: true }),
        message: ' must be a valid URL with protocol'
      }
    },

    google_map_link: {
      type: String,
      trim: true,
    },

    // Cấp bậc & code_level (1..8)
    level: { type: String, enum: LEVEL_ENUM, required: true },
    code_level: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8], required: true },

    // --- [SỬA ĐỔI] Ảnh đại diện (Object) ---
    // Cấu trúc mới: { url: "...", credit: "...", caption: "..." }
    img: {
      type: HeritageImageSchema,
      default: null
    },

    // --- [SỬA ĐỔI] Thư viện ảnh (Mảng Object) ---
    photo_library: [HeritageImageSchema],

    // Nội dung
    Summary: { type: String },
    history: { type: String },
    Heritage: { type: String },

    // tuỳ chọn thêm
    tags: [{ type: String, trim: true }],

    // GeoJSON Coordinate (đã uncomment để dùng được 2dsphere index)
    coordinate: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined // Default undefined để tránh lỗi nếu không nhập
      }
    }
  },
  { timestamps: true }
);

// Giữ nhất quán type <-> type_code
HeritageSchema.pre('validate', function(next) {
  const map = {
    di_san_van_hoa_vat_the: 1,
    di_san_van_hoa_phi_vat_the: 2,
    di_san_thien_nhien: 3
  };
  if (this.type && this.type_code && map[this.type] !== this.type_code) {
    return next(new Error(`type_code (${this.type_code}) không khớp với type (${this.type}).`));
  }
  next();
});

// Ensure coordinate is either fully specified ([lng, lat]) or removed to avoid 2dsphere index errors
HeritageSchema.pre('validate', function(next) {
  // Chỉ xử lý nếu coordinate có tồn tại và coordinates là mảng có dữ liệu
  if (this.coordinate && this.coordinate.coordinates && this.coordinate.coordinates.length > 0) {
    const coords = this.coordinate.coordinates;
    const valid = Array.isArray(coords) && coords.length === 2 && coords.every(n => typeof n === 'number' && Number.isFinite(n));
    if (!valid) {
      // Nếu nhập sai format thì xóa đi để không lỗi index
      this.coordinate = undefined;
    } else {
      // Nếu đúng thì gán type là Point
      this.coordinate.type = 'Point';
    }
  } else {
    // Nếu rỗng hoặc null thì set undefined để Mongo bỏ qua index này
    this.coordinate = undefined;
  }
  next();
});

// Index cho tìm kiếm & geo
HeritageSchema.index({ coordinate: '2dsphere' });
HeritageSchema.index({ ward_codename: 1, type_code: 1, code_level: 1 });
HeritageSchema.index({ name: 'text', Summary: 'text', history: 'text', Heritage: 'text' });

export const Heritage = mongoose.model('Heritage', HeritageSchema);
export const __ENUMS = { TYPE_ENUM, LEVEL_ENUM };