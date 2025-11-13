export function buildPaging(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '1000000', 10), 1), 1000000);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
