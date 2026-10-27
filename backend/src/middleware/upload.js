const multer = require('multer');
const path = require('path');

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  const error = new Error('Format file tidak didukung. Gunakan PDF, Word, Excel, atau gambar.');
  error.status = 400;
  cb(error);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function validateUploadedFile(req, res, next) {
  if (!req.file) return next();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const data = req.file.buffer;
  const starts = bytes => bytes.every((byte, index) => data[index] === byte);
  const isPdf = data.subarray(0, 5).toString('ascii') === '%PDF-';
  const isPng = starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = starts([0xff, 0xd8, 0xff]);
  const isOle = starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const isZip = starts([0x50, 0x4b, 0x03, 0x04]);
  const zipNames = isZip ? data.toString('latin1') : '';
  const valid = {
    '.pdf': isPdf,
    '.png': isPng,
    '.jpg': isJpeg,
    '.jpeg': isJpeg,
    '.doc': isOle,
    '.xls': isOle,
    '.docx': isZip && zipNames.includes('word/'),
    '.xlsx': isZip && zipNames.includes('xl/'),
  }[ext];
  if (valid) return next();
  const error = new Error('Isi file tidak sesuai dengan format atau file rusak.');
  error.status = 400;
  error.code = 'INVALID_FILE_CONTENT';
  return next(error);
}

module.exports = upload;
module.exports.validateUploadedFile = validateUploadedFile;
