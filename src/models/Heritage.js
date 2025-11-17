import mongoose from 'mongoose';
import isURL from 'validator/lib/isURL.js';

const TYPE_ENUM = [
  'di_san_van_hoa_vat_the',      // 1
  'di_san_van_hoa_phi_vat_the',  // 2
  'di_san_thien_nhien'           // 3 (phụ)
];

const LEVEL_ENUM = [
  // Trong nước
  'cap_tinh',                // 1
  'cap_quoc_gia',            // 2
  'cap_dac_biet',            // 3
  // Thế giới (UNESCO)
  'di_san_the_gioi',         // 4
  'ds_phi_vat_the_dai_dien', // 5
  'ky_uc_the_gioi',          // 6
  'khu_du_tru_sinh_quyen',   // 7
  'cong_vien_dia_chat_toan_cau' // 8
];

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
        message: 'wiki_link must be a valid URL with protocol'
      }
    },

    // Tọa độ GeoJSON (để near, radius km) - GIỮ NGUYÊN CẤU TRÚC
    coordinate: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        // [lng, lat]
        type: [Number],
        validate: {
          validator: (arr) => !arr || (arr.length === 2 && arr.every(n => typeof n === 'number')),
          message: 'coordinate must be [lng, lat]'
        }
      }
    },

    // ▼▼▼ THÊM TRƯỜNG MỚI: GOOGLE MAPS URL ▼▼▼
    google_map_link: {
      type: String,
      trim: true,
    },
    // ▲▲▲ KẾT THÚC THÊM TRƯỜNG MỚI ▲▲▲

    // Cấp bậc & code_level (1..8)
    level: { type: String, enum: LEVEL_ENUM, required: true },
    code_level: { type: Number, enum: [1,2,3,4,5,6,7,8], required: true },

    // Ảnh
    img: {
      type: String,
      validate: {
        validator: (v) => {
          if (!v) return true;
          if (typeof v !== 'string') return false;
          // allow absolute URLs with protocol OR server-relative paths OR plain filenames
          // Accept localhost/IP URLs by allowing no-TLD in the URL check
          if (isURL(v, { require_protocol: true, require_tld: false })) return true;
          if (v.startsWith('/') || v.startsWith('uploads/')) return true;
          // plain filename like "1691234-uuid.jpg"
          if (/^[\w\-.]+\.[A-Za-z0-9]{2,6}$/.test(v)) return true;
          return false;
        },
        message: 'img must be a URL, a server-relative path, or a filename'
      }
    },
    photo_library: [{
      type: String,
      validate: {
        validator: (v) => {
          if (!v) return true;
          if (typeof v !== 'string') return false;
          // Accept localhost/IP URLs by allowing no-TLD in the URL check
          if (isURL(v, { require_protocol: true, require_tld: false })) return true;
          if (v.startsWith('/') || v.startsWith('uploads/')) return true;
          if (/^[\w\-.]+\.[A-Za-z0-9]{2,6}$/.test(v)) return true;
          return false;
        },
        message: 'photo_library item must be a URL, a server-relative path, or a filename'
      }
    }],

    // Nội dung
    Summary: { type: String },
    history: { type: String },
    Heritage: { type: String },

    // tuỳ chọn thêm
    tags: [{ type: String, trim: true }]
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
  if (this.coordinate) {
    const coords = this.coordinate.coordinates;
    const valid = Array.isArray(coords) && coords.length === 2 && coords.every(n => typeof n === 'number' && Number.isFinite(n));
    if (!valid) {
      this.coordinate = undefined;
    } else {
      this.coordinate.type = 'Point';
    }
  }
  next();
});

// Index cho tìm kiếm & geo
HeritageSchema.index({ coordinate: '2dsphere' });
HeritageSchema.index({ ward_codename: 1, type_code: 1, code_level: 1 });

HeritageSchema.index({ name: 'text', Summary: 'text', history: 'text', Heritage: 'text' });

export const Heritage = mongoose.model('Heritage', HeritageSchema);
export const __ENUMS = { TYPE_ENUM, LEVEL_ENUM };