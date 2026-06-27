import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import FileUpload from '../components/FileUpload/FileUpload';
import FileList from '../components/FileList/FileList';
import { getAllFiles, deleteFile } from '../services/fileService';
import './FilesPage.scss';

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
    setFiles((prev) => [...newFiles, ...prev]);
  };

  const handleDeleteFile = async (savedName) => {
    try {
      await deleteFile(savedName);
      setFiles((prev) => prev.filter((f) => f.savedName !== savedName));
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert('Failed to delete file. Please try again.');
    }
  };

  return (
    <div className="files-page-wrapper">
      <div className="files-container">
        <header className="files-header">
          <h1>
            File Manager <FontAwesomeIcon icon={faFolderOpen} />
          </h1>
          <p>Upload, manage and share your files — all types up to 100MB.</p>
        </header>

        <section className="files-section">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </section>

        <section className="files-section">
          <div className="files-section-head">
            <h2 className="section-title">My Files</h2>
            <button
              onClick={fetchFiles}
              className="files-refresh-btn"
              title="Refresh list"
              disabled={loading}
            >
              <FontAwesomeIcon icon={faRotateRight} spin={loading} />
              <span>Refresh</span>
            </button>
          </div>

          {error && (
            <div className="files-error">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <div>
                <p className="files-error-title">Error</p>
                <p className="files-error-msg">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="files-loading">
              <span className="files-spinner" />
              <p>Loading your files...</p>
            </div>
          ) : (
            <FileList files={files} onDelete={handleDeleteFile} />
          )}
        </section>
      </div>
    </div>
  );
};

export default FilesPage;
