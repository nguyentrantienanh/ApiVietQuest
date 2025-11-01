// src/services/province.service.js
import axios from 'axios';

// Cache cho 2 loại dữ liệu
let provincesCache = null; // Dùng cho options { name, codename }
let districtToProvinceMapCache = null; // Dùng để tra cứu Huyện -> Tỉnh

/**
* Lấy danh sách Tỉnh/Thành (và map Huyện -> Tỉnh) từ API
*/
export async function getProvinces() {
 // Nếu có cache, trả về ngay
 if (provincesCache && districtToProvinceMapCache) {
  return { allProvinces: provincesCache, districtMap: districtToProvinceMapCache };
 }
 try {
  // Gọi API lấy đầy đủ Tỉnh (depth=1) và Huyện (depth=2)
  const response = await axios.get('https://provinces.open-api.vn/api/?depth=2');
  
  if (!response.data || !Array.isArray(response.data)) {
    throw new Error('API tỉnh/thành không trả về dữ liệu mảng');
  }
  const allProvinces = [];
  const districtMap = new Map();
  for (const province of response.data) {
    // 1. Thêm vào danh sách Tỉnh (để làm đáp án)
    allProvinces.push({ name: province.name, codename: province.codename });

    // 2. Thêm các huyện/quận của tỉnh này vào bản đồ tra cứu
    if (province.districts && Array.isArray(province.districts)) {
      for (const district of province.districts) {
        // Key: "quan_ba_dinh", Value: "thanh_pho_ha_noi"
        districtMap.set(district.codename, province.codename);
      }
    }
  }
  // Lưu vào cache
  provincesCache = allProvinces;
  districtToProvinceMapCache = districtMap;
  return { allProvinces: provincesCache, districtMap: districtToProvinceMapCache };
 } catch (error) {
  console.error("Lỗi khi lấy danh sách tỉnh (depth=2):", error.message);
  // Xóa cache nếu lỗi
  provincesCache = null;
  districtToProvinceMapCache = null;
  throw error; // Ném lỗi ra ngoài
 }
}