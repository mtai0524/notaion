import React, { useState, useRef } from 'react';
import { uploadFiles, uploadFilesToCloudinary } from '../../services/fileService';
import { message as antdMessage } from 'antd';

const FileUpload = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [storageMode, setStorageMode] = useState('local');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      const uploader = storageMode === 'cloudinary' ? uploadFilesToCloudinary : uploadFiles;
      const uploadedMetadata = await uploader(selectedFiles, (percent) => {
        setProgress(percent);
      });

      antdMessage.success(
        storageMode === 'cloudinary'
          ? 'Đã upload lên Cloudinary!'
          : 'Files uploaded successfully!'
      );
      setSelectedFiles([]);
      if (onUploadSuccess) {
        onUploadSuccess(uploadedMetadata);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      antdMessage.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto p-6 bg-white font-['Mali']"
      style={{
        border: 'var(--global-border-width, 2px) var(--global-border-style, solid) var(--global-border-color, black)',
        boxShadow: 'var(--global-shadow-x, -4px) var(--global-shadow-y, 4px) 0px 0px var(--global-border-color, #111827)',
        borderRadius: 'var(--global-border-radius, 0px)'
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest">Storage</span>
        <div
          role="tablist"
          aria-label="Chọn nơi lưu trữ"
          className="inline-flex bg-gray-50"
          style={{
            border: '2px solid var(--global-border-color, black)',
            borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
          }}
        >
          {[
            { value: 'local', label: 'Local' },
            { value: 'cloudinary', label: 'Cloudinary' }
          ].map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={storageMode === opt.value}
              onClick={() => setStorageMode(opt.value)}
              disabled={uploading}
              className={`px-3 py-1 text-xs font-black uppercase tracking-widest transition-colors ${
                storageMode === opt.value ? 'bg-yellow-200 text-black' : 'bg-white text-gray-500 hover:bg-yellow-50'
              } ${idx === 0 ? 'border-r-2 border-black' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed border-black p-8 text-center transition-all duration-200 ${
          dragActive 
            ? "bg-yellow-50 translate-x-1 -translate-y-1 shadow-[-4px_4px_0px_0px_#111827]" 
            : "bg-transparent"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div 
            className="p-3 bg-yellow-100"
            style={{
              border: '2px solid var(--global-border-color, black)',
              boxShadow: 'calc(var(--global-shadow-x, -4px) * 0.5) calc(var(--global-shadow-y, 4px) * 0.5) 0px 0px var(--global-border-color, #111827)',
              borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div>
            <p className="text-lg font-bold text-black uppercase tracking-tight">
              Drag & Drop Files
            </p>
            <p className="text-sm text-gray-600 mt-1">
              or click the button below
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="px-6 py-2 bg-white font-bold uppercase tracking-widest hover:bg-yellow-100 transition-all active:translate-x-0.5 active:-translate-y-0.5"
            style={{
              border: '2px solid var(--global-border-color, black)',
              borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
            }}
          >
            Browse
          </button>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-center border-b-2 border-black pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Selected ({selectedFiles.length})
            </h3>
            <button 
              onClick={() => setSelectedFiles([])}
              className="text-xs font-bold text-red-600 uppercase hover:underline"
              disabled={uploading}
            >
              Clear All
            </button>
          </div>
          <ul className="divide-y-2 divide-gray-100 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {selectedFiles.map((file, index) => (
              <li key={index} className="py-3 flex items-center justify-between group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div 
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-50"
                    style={{
                      border: '2px solid var(--global-border-color, black)',
                      boxShadow: 'calc(var(--global-shadow-x, -4px) * 0.5) calc(var(--global-shadow-y, 4px) * 0.5) 0px 0px var(--global-border-color, #111827)',
                      borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-black truncate">{file.name}</p>
                    <p className="text-xs text-gray-500 font-medium italic">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 border-2 border-transparent hover:border-black hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                  disabled={uploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t-2 border-black">
            {uploading && (
              <div className="mb-6">
                <div className="flex justify-between mb-2 text-xs font-bold uppercase">
                  <span>Uploading...</span>
                  <span>{progress}%</span>
                </div>
                <div 
                  className="w-full bg-gray-100 h-4 overflow-hidden"
                  style={{
                    border: '2px solid var(--global-border-color, black)',
                    boxShadow: 'calc(var(--global-shadow-x, -4px) * 0.5) calc(var(--global-shadow-y, 4px) * 0.5) 0px 0px var(--global-border-color, #111827)',
                    borderRadius: 'calc(var(--global-border-radius, 0px) * 0.5)'
                  }}
                >
                  <div 
                    className="bg-green-400 h-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`w-full py-3 font-black uppercase tracking-[0.2em] transition-all ${
                uploading 
                  ? "bg-gray-200 cursor-not-allowed opacity-50" 
                  : "bg-blue-400 hover:bg-blue-500 active:translate-x-0.5 active:-translate-y-0.5"
              }`}
              style={{
                border: 'var(--global-border-width, 2px) var(--global-border-style, solid) var(--global-border-color, black)',
                boxShadow: !uploading ? 'var(--global-shadow-x, -4px) var(--global-shadow-y, 4px) 0px 0px var(--global-border-color, #111827)' : 'none',
                borderRadius: 'var(--global-border-radius, 0px)'
              }}
            >
              {uploading
                ? "Wait..."
                : `Push ${selectedFiles.length} ${selectedFiles.length === 1 ? 'File' : 'Files'} → ${storageMode === 'cloudinary' ? 'Cloudinary' : 'Local'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
