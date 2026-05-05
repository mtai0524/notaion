import React, { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload/FileUpload';
import FileList from '../components/FileList/FileList';
import { getAllFiles, deleteFile } from '../services/fileService';

const FilesPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const data = await getAllFiles();
      setFiles(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load files. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (newFiles) => {
    setFiles(prev => [...newFiles, ...prev]);
  };

  const handleDeleteFile = async (savedName) => {
    try {
      await deleteFile(savedName);
      setFiles(prev => prev.filter(f => f.savedName !== savedName));
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert('Failed to delete file. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl files-page-container">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4">
          File Manager
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Upload, manage, and share your files securely. All file types are supported up to 100MB.
        </p>
      </header>

      <section className="mb-12">
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            My Files
          </h2>
          <button 
            onClick={fetchFiles}
            className="p-2 text-gray-500 hover:text-blue-500 transition-colors rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
            title="Refresh list"
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-r-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading your files...</p>
          </div>
        ) : (
          <FileList files={files} onDelete={handleDeleteFile} />
        )}
      </section>
    </div>
  );
};

export default FilesPage;
