import React, { useState } from 'react';
import { downloadFile } from '../../services/fileService';

const FileList = ({ files, onDelete }) => {
  const [copiedId, setCopiedId] = useState(null);
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
      day: 'numeric'
    });
  };

  const getFileIcon = (contentType, fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();

    if (contentType && contentType.startsWith('image/')) return '🖼️';
    if (contentType && contentType.startsWith('video/')) return '🎥';
    if (contentType && contentType.startsWith('audio/')) return '🎵';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)) return '🖼️';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) return '🎥';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) return '🎵';
    if (contentType === 'application/pdf' || extension === 'pdf') return '📄';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return '📦';
    if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(extension)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(extension)) return '📊';
    if (['ppt', 'pptx'].includes(extension)) return '📽️';
    if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'php', 'sh', 'xml', 'yml', 'yaml'].includes(extension)) return '💻';

    return '📁';
  };

  const handleCopyLink = async (url, id) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  const handleDelete = (savedName, originalName) => {
    if (window.confirm(`Delete "${originalName}"?`)) {
      onDelete(savedName);
    }
  };

  if (files.length === 0) {
    return (
      <div 
        className="text-center py-16 bg-[#fafafa] border-2 border-dashed font-['Mali']"
        style={{ 
          borderColor: 'var(--global-border-color, black)',
          boxShadow: 'var(--global-shadow-x, -4px) var(--global-shadow-y, 4px) 0px 0px var(--global-border-color, #111827)',
          borderRadius: 'var(--global-border-radius, 0px)'
        }}
      >
        <div className="text-5xl mb-4 grayscale opacity-50">📤</div>
        <p className="text-gray-600 font-bold uppercase tracking-widest">Storage is empty</p>
      </div>
    );
  }

  return (
    <div 
      className="bg-white border-2 overflow-hidden font-['Mali']"
      style={{ 
        borderColor: 'var(--global-border-color, black)',
        boxShadow: 'var(--global-shadow-x, -4px) var(--global-shadow-y, 4px) 0px 0px var(--global-border-color, #111827)',
        borderRadius: 'var(--global-border-radius, 0px)'
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-black text-black text-xs uppercase font-black tracking-widest">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Size</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-gray-100">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-yellow-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl drop-shadow-[-1px_1px_0px_rgba(0,0,0,1)]" role="img" aria-label="file icon">
                      {getFileIcon(file.contentType, file.originalName)}
                    </span>
                    <span className="text-sm font-bold text-black truncate max-w-[150px] sm:max-w-[250px]" title={file.originalName}>
                      {file.originalName}
                    </span>
                    {file.cloudUrl && (
                      <span
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-sky-200 border-2 border-black"
                        title="Lưu trên Cloudinary"
                      >
                        Cloud
                      </span>
                    )}
                  </div>
                  {file.cloudUrl && (
                    <div className="flex items-center gap-2 mt-2 ml-9 max-w-[220px] sm:max-w-[340px]">
                      <a
                        href={file.cloudUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-gray-500 truncate underline decoration-dotted hover:text-black"
                        title={file.cloudUrl}
                      >
                        {file.cloudUrl}
                      </a>
                      <button
                        onClick={() => handleCopyLink(file.cloudUrl, file.id)}
                        className="shrink-0 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider border-2 border-black bg-white hover:bg-yellow-100 transition-colors active:translate-x-0.5 active:-translate-y-0.5"
                        title="Copy link URL"
                      >
                        {copiedId === file.id ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-gray-500 italic">
                  {formatFileSize(file.sizeInBytes)}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-gray-500">
                  {formatDate(file.uploadedAt)}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => downloadFile(file.savedName, file.originalName, file.cloudUrl)}
                    className="p-2 border-2 bg-white hover:bg-blue-100 transition-all active:translate-x-0.5 active:-translate-y-0.5 active:shadow-none"
                    style={{
                      borderColor: 'var(--global-border-color, black)',
                      boxShadow: 'calc(var(--global-shadow-x, -4px) * 0.5) calc(var(--global-shadow-y, 4px) * 0.5) 0px 0px var(--global-border-color, #111827)',
                      borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
                    }}
                    title="Download"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(file.savedName, file.originalName)}
                    className="p-2 border-2 bg-white hover:bg-red-100 transition-all active:translate-x-0.5 active:-translate-y-0.5 active:shadow-none"
                    style={{
                      borderColor: 'var(--global-border-color, black)',
                      boxShadow: 'calc(var(--global-shadow-x, -4px) * 0.5) calc(var(--global-shadow-y, 4px) * 0.5) 0px 0px var(--global-border-color, #111827)',
                      borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
                    }}
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
