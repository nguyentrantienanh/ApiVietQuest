
export function validateCreate(body) {
  const required = ['hid', 'ward_codename', 'name', 'type', 'type_code', 'level', 'code_level'];
  const missing = required.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
  if (missing.length) return `Thiếu trường bắt buộc: ${missing.join(', ')}`;

  if (![1,2,3].includes(Number(body.type_code))) return 'type_code phải là 1|2|3';
  if (![1,2,3,4,5,6,7,8].includes(Number(body.code_level))) return 'code_level phải là 1..8';
  return null;
}

export function pickUpdatable(body) {
  const allowed = [
    'ward_codename','name','type','type_code','wiki_link',
    'coordinate','level','code_level','img','photo_library',
    'Summary','history','Heritage','tags'
  ];
  const out = {};
  for (const k of allowed) if (k in body) out[k] = body[k];
  return out;
}
