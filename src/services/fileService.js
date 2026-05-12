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
 * Download a file. Nếu là file Cloudinary (có cloudUrl) thì mở trực tiếp,
 * còn không thì gọi backend như cũ.
 * @param {string} savedName
 * @param {string} originalName
 * @param {string} [cloudUrl]
 */
export const downloadFile = async (savedName, originalName, cloudUrl) => {
  if (cloudUrl) {
    const link = document.createElement('a');
    link.href = cloudUrl;
    link.setAttribute('download', originalName);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    return;
  }

  const response = await axiosInstance.get(`/api/files/download/${savedName}`, {
    responseType: 'blob'
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', originalName);
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
