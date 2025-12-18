import axios from 'axios';
let allProvincesCache = []; // Dùng cho options { name, codename }
let wardMapCache = new Map(); // <-- SỬA 1: Đổi tên thành wardMapCache
let lastFetched = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // Cache 24 giờ

// SỬA 2: Dùng API mới (xat-nhap v2)vn-admin-areas-sap-nhap
const PROVINCES_API = 'https://vn-admin-areas-sap-nhap.onrender.com/v2/provinces';
const WARDS_API = 'https://vn-admin-areas-sap-nhap.onrender.com/v2/wards';

/**
 * Tải và cache dữ liệu Tỉnh/Thành và Phường/Xã
 */
async function fetchAndCacheData() {
  console.log('Đang làm mới cache Tỉnh/Thành/Phường/Xã...');
  try {
    // SỬA 3: Gọi đồng thời 2 API
    const [provincesRes, wardsRes] = await Promise.all([
      axios.get(PROVINCES_API),
      axios.get(WARDS_API)
    ]);

    const provincesData = Array.isArray(provincesRes.data) ? provincesRes.data : [];
    const wardsData = Array.isArray(wardsRes.data) ? wardsRes.data : [];

    if (provincesData.length === 0 || wardsData.length === 0) {
      throw new Error('API trả về dữ liệu rỗng cho Tỉnh hoặc Phường/Xã.');
    }

    // 1. Dữ liệu Tỉnh (dùng làm đáp án)
    const allProvinces = provincesData.map(p => ({ name: p.name, codename: p.codename }));

    // 2. Tạo bản đồ tra cứu: province.code (số) -> province.codename (chữ)
    // Ví dụ: 1 -> "thanh_pho_ha_noi"
    const provinceCodeMap = new Map();
    for (const p of provincesData) {
      provinceCodeMap.set(p.code, p.codename);
    }

    // 3. Xây dựng bản đồ tra cứu Phường/Xã -> Tỉnh
    const newWardMap = new Map();
    for (const w of wardsData) {
      // API /v2/wards trả về 'province_code' (số)
      const provinceCodename = provinceCodeMap.get(w.province_code);
      if (provinceCodename) {
        // Map: "phuong_ba_dinh" -> "thanh_pho_ha_noi"
        newWardMap.set(w.codename, provinceCodename);
      }
    }

    // Lưu vào cache
    allProvincesCache = allProvinces;
    wardMapCache = newWardMap;
    lastFetched = Date.now();
    console.log(`Cache được làm mới: ${allProvincesCache.length} Tỉnh, ${wardMapCache.size} Phường/Xã.`);

  } catch (e) {
    console.error("LỖI NGHIÊM TRỌNG khi tải dữ liệu Tỉnh/Phường/Xã:", e.message);
    // Xóa cache nếu lỗi
    allProvincesCache = [];
    wardMapCache = new Map();
    lastFetched = 0;
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
  if (now - lastFetched > CACHE_TTL || wardMapCache.size === 0) {
    await fetchAndCacheData();
  }

  // SỬA 4: Trả về 'wardMap'
  return { allProvinces: allProvincesCache, wardMap: wardMapCache };
}