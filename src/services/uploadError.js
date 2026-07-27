/* Bóc thông báo lỗi thật từ một upload thất bại.
   Trước đây mọi chỗ catch đều hiện "Failed to upload file", che mất nguyên nhân
   thật (413 của nginx, 400 của Cloudinary, timeout, mất mạng…) nên không thể
   biết phải sửa ở đâu. Helper này là hàm thuần trên object lỗi của axios. */

/* Cloudinary/backend trả thông báo ở nhiều hình dạng khác nhau tuỳ tầng nào
   chặn. Lấy chuỗi đầu tiên tìm được, theo thứ tự cụ thể → chung. */
const serverMessage = (data) => {
  if (!data) return null;
  if (typeof data === 'string') return data.trim() || null;
  if (typeof data !== 'object') return null;
  const cand = data.error?.message ?? data.message ?? data.title ?? data.detail ?? data.Message;
  if (typeof cand === 'string' && cand.trim()) return cand.trim();
  // ASP.NET ModelState: { errors: { files: ["..."] } }
  const errs = data.errors;
  if (errs && typeof errs === 'object') {
    for (const v of Object.values(errs)) {
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
    }
  }
  return null;
};

export const MB = 1024 * 1024;

/* Trần cứng của gói Cloudinary Free (Settings → Plan):
   ảnh 10MB · raw file (pdf/zip/xlsx/docx…) 10MB · video 100MB.
   Đây là giới hạn tài khoản, áp cho MỌI đường upload kể cả đi qua backend —
   không có cờ nào bật để vượt, và upload_large/chunked cũng không giúp
   (giới hạn tính trên file hoàn chỉnh, không phải từng mảnh). */
export const CLOUDINARY_LIMITS = { image: 10 * MB, video: 100 * MB, raw: 10 * MB };

/* Cloudinary phân loại theo resource_type; kích thước trần khác nhau theo loại. */
export function cloudinaryKind(file) {
  const t = file?.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  return 'raw';
}

/* File này có vượt trần Cloudinary không? */
export function exceedsCloudinary(file) {
  const size = file?.size;
  if (typeof size !== 'number' || !Number.isFinite(size)) return false;
  return size > CLOUDINARY_LIMITS[cloudinaryKind(file)];
}

/* Chia lô file thành 2 nhóm theo đích đến. File vượt trần Cloudinary được
   chuyển sang lưu trên server của mình thay vì thất bại. */
export function splitByDestination(files = []) {
  const cloud = [], local = [];
  for (const f of files) (exceedsCloudinary(f) ? local : cloud).push(f);
  return { cloud, local };
}

/* File này lưu ở server mình hay trên Cloudinary?
   Cloudinary trả `cloudUrl`; file lưu nội bộ thì không có. */
export function isLocalStored(meta) {
  return !!meta && !meta.cloudUrl;
}

/* Câu cảnh báo hiện sau khi upload xong, khi có file phải lưu nội bộ.
   Nói thẳng rủi ro: file nằm trên server ứng dụng, không phải CDN, nên có thể
   mất khi triển khai lại hoặc dọn ổ đĩa. */
export function localStorageWarning(metas = []) {
  const local = metas.filter(isLocalStored);
  if (!local.length) return null;
  const names = local.map((m) => m?.originalName).filter(Boolean);
  const what = names.length === 1 ? `"${names[0]}"` : `${local.length} file`;
  return `${what} vượt giới hạn 10MB của Cloudinary nên được lưu trên server ứng dụng. `
    + `File loại này có thể mất khi server được cập nhật hoặc dọn dẹp — `
    + `hãy giữ một bản sao riêng.`;
}

export const formatBytes = (bytes) => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
};

/* Dịch một lỗi upload thành câu tiếng Việt nói rõ tầng nào chặn và làm gì tiếp.
   `files` (tuỳ chọn) dùng để nhắc dung lượng file lớn nhất trong lô. */
export function describeUploadError(error, files = []) {
  const status = error?.response?.status;
  const server = serverMessage(error?.response?.data);
  const biggest = files.reduce((m, f) => (f?.size > (m?.size ?? -1) ? f : m), null);
  const sizeNote = biggest ? ` (file lớn nhất: ${formatBytes(biggest.size)})` : '';

  // Không có response = request chưa từng tới nơi.
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
      return `Upload quá thời gian chờ${sizeNote}. File lớn có thể cần tăng timeout ở server.`;
    }
    return `Không gửi được lên server${sizeNote}: ${error?.message || 'mất kết nối'}.`;
  }

  if (status === 413) {
    return `Server từ chối vì file quá lớn${sizeNote} — HTTP 413. `
      + `Đây là giới hạn của backend/nginx, KHÔNG phải Cloudinary. `
      + `Cần tăng client_max_body_size (nginx) và giới hạn multipart của backend.`;
  }
  if (status === 401 || status === 403) {
    return `Không có quyền upload (HTTP ${status})${server ? ` — ${server}` : ''}. Thử đăng nhập lại.`;
  }
  if (status === 400) {
    return `Server báo lỗi ${status}${sizeNote}: ${server || 'không rõ lý do'}.`;
  }
  if (status >= 500) {
    return `Server lỗi ${status}${sizeNote}${server ? `: ${server}` : ''}. `
      + `Nếu chỉ xảy ra với file lớn, nhiều khả năng là giới hạn dung lượng ở backend.`;
  }
  return `Upload thất bại (HTTP ${status})${sizeNote}${server ? `: ${server}` : ''}.`;
}
