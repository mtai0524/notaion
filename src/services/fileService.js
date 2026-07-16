import axiosInstance from '../axiosConfig';

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
 * Upload files to Cloudinary (via backend)
 * @param {File[]} files
 * @param {Function} onProgress
 * @returns {Promise<FileMetadata[]>}
 */
export const uploadFilesToCloudinary = async (files, onProgress) => {
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
