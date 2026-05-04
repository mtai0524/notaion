import React from 'react';
import { downloadFile } from '../../services/fileService';

const FileList = ({ files, onDelete }) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (contentType, fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (contentType && contentType.startsWith('image/')) return '🖼️';
    if (contentType && contentType.startsWith('video/')) return '🎥';
    if (contentType && contentType.startsWith('audio/')) return '🎵';
    if (contentType === 'application/pdf') return '📄';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return '📦';
    if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(extension)) return '📊';
    
    return '📁';
  };

  const handleDelete = (savedName, originalName) => {
    if (window.confirm(`Are you sure you want to delete "${originalName}"?`)) {
      onDelete(savedName);
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
        <div className="text-4xl mb-4">📭</div>
        <p className="text-gray-500 dark:text-gray-400">No files uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase font-semibold tracking-wider">
              <th className="px-6 py-4">File Name</th>
              <th className="px-6 py-4">Size</th>
              <th className="px-6 py-4">Upload Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl" role="img" aria-label="file icon">
                      {getFileIcon(file.contentType, file.originalName)}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]" title={file.originalName}>
                      {file.originalName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(file.sizeInBytes)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(file.uploadedAt)}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => downloadFile(file.savedName, file.originalName)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                    title="Download"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(file.savedName, file.originalName)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileList;
