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
 * Get all files from the server
 * @returns {Promise<FileMetadata[]>}
 */
export const getAllFiles = async () => {
  const response = await axiosInstance.get('/api/files');
  return response.data;
};

/**
 * Download a file from the server
 * @param {string} savedName 
 * @param {string} originalName 
 */
export const downloadFile = async (savedName, originalName) => {
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
