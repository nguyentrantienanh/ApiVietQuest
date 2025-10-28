// Utility to convert enum keys to human-friendly Vietnamese labels
export const TYPE_LABELS = {
  di_san_van_hoa_vat_the: 'Di sản văn hoá vật thể',
  di_san_van_hoa_phi_vat_the: 'Di sản văn hoá phi vật thể',
  di_san_thien_nhien: 'Di sản thiên nhiên'
};

export const LEVEL_LABELS = {
  cap_tinh: 'Cấp tỉnh',
  cap_quoc_gia: 'Cấp quốc gia',
  cap_dac_biet: 'Cấp đặc biệt',
  di_san_the_gioi: 'Di sản thế giới',
  ds_phi_vat_the_dai_dien: 'Phi vật thể đại diện',
  ky_uc_the_gioi: 'Ký ức thế giới',
  khu_du_tru_sinh_quyen: 'Khu dự trữ sinh quyển',
  cong_vien_dia_chat_toan_cau: 'Công viên địa chất toàn cầu'
};

export function typeLabel(key){
  if (!key) return '';
  return TYPE_LABELS[key] || key.replace(/_/g, ' ');
}

export function levelLabel(key){
  if (!key) return '';
  return LEVEL_LABELS[key] || key.replace(/_/g, ' ');
}

export default { typeLabel, levelLabel };
