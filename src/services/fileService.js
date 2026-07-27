import axiosInstance from '../axiosConfig';
import { splitByDestination } from './uploadError';

/**
 * @typedef {Object} FileMetadata
 * @property {string} id
 * @property {string} originalName
 * @property {string} savedName
 * @property {string} contentType
 * @property {number} sizeInBytes
 * @property {string} uploadedAt
 */

/**
 * Upload files to the server
 * @param {File[]} files
 * @param {Function} onProgress
 * @returns {Promise<FileMetadata[]>}
 */
export const uploadFiles = async (files, onProgress) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await axiosInstance.post('/api/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    }
  });
  return response.data;
};

/**
 * URL xem/tải một file đã upload, dùng được cho cả hai nơi lưu.
 * File Cloudinary có `cloudUrl`; file lưu trên server thì không, phải trỏ về
 * endpoint download của backend theo `savedName`.
 * @param {FileMetadata} meta
 * @returns {string}
 */
export const fileUrlOf = (meta) => {
  if (!meta) return '';
  if (meta.cloudUrl) return meta.cloudUrl;
  if (!meta.savedName) return '';
  const base = (axiosInstance.defaults.baseURL || '').replace(/\/$/, '');
  return `${base}/api/files/download/${encodeURIComponent(meta.savedName)}`;
};

/** Gửi thẳng lên Cloudinary (qua backend), không định tuyến. Dùng nội bộ. */
const postToCloudinary = async (files, onProgress) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await axiosInstance.post('/api/files/upload/cloudinary', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    }
  });
  return response.data;
};

/**
 * Upload files, tự chọn nơi lưu theo dung lượng.
 *
 * Gói Cloudinary Free chặn cứng ở 10MB cho ảnh và raw file (xlsx/pdf/zip…) —
 * giới hạn của tài khoản nên đi qua backend cũng không lách được, và
 * upload_large/chunked cũng vô ích vì giới hạn tính trên file hoàn chỉnh.
 * File vượt trần được lưu vào server của mình (`/api/files/upload`) thay vì
 * để thất bại; file nhỏ vẫn lên Cloudinary như cũ để hưởng CDN.
 *
 * Giữ nguyên tên hàm và hình dạng kết quả để các nơi gọi không phải đổi.
 * @param {File[]} files
 * @param {Function} onProgress
 * @returns {Promise<FileMetadata[]>}
 */
export const uploadFilesToCloudinary = async (files, onProgress) => {
  const list = Array.from(files || []);
  const { cloud, local } = splitByDestination(list);

  // Đường thường: mọi file đều vừa trần — giữ nguyên hành vi cũ hoàn toàn.
  if (!local.length) return postToCloudinary(list, onProgress);

  // Có file quá lớn. Chạy song song rồi ghép lại theo đúng thứ tự đầu vào,
  // để nơi gọi (vốn hay map 1-1 với `files`) không bị lệch thứ tự.
  const [cloudRes, localRes] = await Promise.all([
    cloud.length ? postToCloudinary(cloud, onProgress) : Promise.resolve([]),
    uploadFiles(local, cloud.length ? undefined : onProgress),
  ]);

  const byName = new Map();
  [...(cloudRes || []), ...(localRes || [])].forEach((r) => {
    if (r?.originalName && !byName.has(r.originalName)) byName.set(r.originalName, r);
  });
  const ordered = list.map((f) => byName.get(f.name)).filter(Boolean);
  // Nếu backend không trả originalName như mong đợi thì đừng làm mất dữ liệu —
  // rơi về nối đơn giản.
  return ordered.length === (cloudRes.length + localRes.length)
    ? ordered
    : [...(cloudRes || []), ...(localRes || [])];
};

/**
 * Get all files from the server
 * @returns {Promise<FileMetadata[]>}
 */
export const getAllFiles = async () => {
  const response = await axiosInstance.get('/api/files');
  return response.data;
};

/**
 * Download a file.
 * - Cloudinary files (có cloudUrl): tải trực tiếp từ Cloudinary bằng cờ
 *   `fl_attachment` để giữ tên file gốc. Yêu cầu account Cloudinary đã bỏ chặn
 *   "PDF and ZIP files" (Settings → Security), nếu không sẽ trả 401.
 * - File cục bộ: tải qua backend như cũ.
 * @param {string} savedName
 * @param {string} originalName
 * @param {string} [cloudUrl]
 */
// Force a Cloudinary URL to download with the original filename by inserting the
// `fl_attachment` delivery flag after `/upload/`. Works for image/video/raw.
const withAttachment = (cloudUrl, originalName) => {
  const base = (originalName || 'file').replace(/\.[^./]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const flag = `fl_attachment:${base}`;
  // insert after the first "/upload/" (or "/fetch/") segment
  if (/\/upload\//.test(cloudUrl)) return cloudUrl.replace('/upload/', `/upload/${flag}/`);
  return cloudUrl; // unknown shape — return as-is (anchor download still tries)
};

export const downloadFile = async (savedName, originalName, cloudUrl) => {
  // Cloudinary files: tải thẳng từ Cloudinary (không qua backend).
  if (cloudUrl) {
    const link = document.createElement('a');
    link.href = withAttachment(cloudUrl, originalName);
    link.setAttribute('download', originalName || '');
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    return;
  }

  // File cục bộ: tải qua backend, trả blob để đặt đúng tên file.
  const response = await axiosInstance.get(
    `/api/files/download/${encodeURIComponent(savedName)}`,
    { responseType: 'blob' }
  );
  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', originalName || '');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Delete a file from the server
 * @param {string} savedName 
 * @returns {Promise<void>}
 */
export const deleteFile = async (savedName) => {
  await axiosInstance.delete(`/api/files/${savedName}`);
};
