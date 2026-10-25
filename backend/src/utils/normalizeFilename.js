function normalizeFilename(value) {
  if (typeof value !== 'string' || !/[ÃÂÐÑ]/u.test(value)) return value;
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? value : decoded;
}

module.exports = { normalizeFilename };
