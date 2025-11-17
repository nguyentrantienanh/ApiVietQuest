// src/services/province.service.js
import axios from 'axios';

// Cache (giữ trong memory của server)
let allProvinces = [];
let wardMap = new Map(); // <-- Đổi tên từ districtMap
let lastFetched = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // Cache 24 giờ

const PROVINCES_API = 'https://vn-admin-areas-xat-nhap.onrender.com/v2/provinces';
const WARDS_API = 'https://vn-admin-areas-xat-nhap.onrender.com/v2/wards'; // <-- SỬA 1: Dùng API /v2/wards

async function fetchAndCacheData() {
  console.log('Đang làm mới cache Tỉnh/Thành/Phường/Xã...');
  try {
    const [provincesRes, wardsRes] = await Promise.all([
      axios.get(PROVINCES_API),
      axios.get(WARDS_API) // <-- SỬA 2: Tải wards (phường/xã)
    ]);

    const provincesData = Array.isArray(provincesRes.data) ? provincesRes.data : [];
    const wardsData = Array.isArray(wardsRes.data) ? wardsRes.data : [];

    if (provincesData.length === 0 || wardsData.length === 0) {
      throw new Error('API trả về dữ liệu rỗng cho Tỉnh hoặc Phường/Xã.');
    }

    const newWardMap = new Map();
    
    // SỬA 3: Xây dựng wardMap (phuong_xa_codename -> tinh_thanh_codename)
    
    // 3a. Tạo map tra cứu province_code (số) -> province_codename (chữ)
    const provinceCodeToCodename = new Map();
    for (const p of provincesData) {
      provinceCodeToCodename.set(p.code, p.codename);
    }

    // 3b. Dùng map trên để xây dựng wardMap
    for (const w of wardsData) {
      // API wards trả về 'province_code' (số)
      const provinceCodename = provinceCodeToCodename.get(w.province_code);
      if (provinceCodename) {
        // Map: 'phuong_ba_dinh' -> 'thanh_pho_ha_noi'
        newWardMap.set(w.codename, provinceCodename);
      }
    }
    
    // Cập nhật cache
    allProvinces = provincesData;
    wardMap = newWardMap; // <-- SỬA 4: Gán cho wardMap
    lastFetched = Date.now();
    console.log(`Cache được làm mới: ${allProvinces.length} Tỉnh, ${wardMap.size} Phường/Xã.`);

  } catch (e) {
    console.error("LỖI NGHIÊM TRỌNG khi tải dữ liệu Tỉnh/Phường/Xã:", e.message);
    throw new Error(`Lỗi tải dữ liệu hành chính: ${e.message}`);
  }
}

/**
 * Lấy danh sách Tỉnh và bản đồ Phường/Xã (đã cache)
 * Trả về { allProvinces, wardMap }
 */
export async function getProvinces() {
  const now = Date.now();
  // Tải lại nếu cache rỗng hoặc quá 24 giờ
  if (now - lastFetched > CACHE_TTL || wardMap.size === 0) {
    await fetchAndCacheData();
  }

  // SỬA 5: Trả về 'wardMap'
  return { allProvinces, wardMap };
}