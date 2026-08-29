import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFile, FiX, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { uploadFile } from '../services/api';

const styles = {
  zone: (isDragActive) => ({
    border: `2px dashed ${isDragActive ? '#38bdf8' : '#334155'}`,
    borderRadius: '12px',
    padding: '40px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragActive ? 'rgba(56,189,248,0.05)' : '#0f172a',
    transition: 'all 0.2s',
    color: '#64748b',
  }),
  icon: { color: '#38bdf8', marginBottom: '12px' },
  heading: { fontSize: '15px', color: '#94a3b8', marginBottom: '6px' },
  sub:     { fontSize: '12px', color: '#475569' },
  fileList: { marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  fileItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '8px', padding: '10px 14px',
  },
  fileName:  { flex: 1, fontSize: '13px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileSize:  { fontSize: '11px', color: '#475569' },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px', display: 'flex' },
  uploadBtn: {
    marginTop: '16px',
    width: '100%',
    padding: '12px',
    background: '#0369a1',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  progress: {
    marginTop: '8px',
    height: '4px',
    background: '#334155',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressBar: (pct) => ({
    height: '100%',
    width: `${pct}%`,
    background: '#38bdf8',
    transition: 'width 0.3s',
    borderRadius: '999px',
  }),
};

/**
 * FileUpload
 * Drag-and-drop file uploader. Calls the /api/files/upload endpoint,
 * which stores the file in AWS S3 and logs the event to Firebase.
 *
 * Props:
 *   onSuccess (fn) — called with the uploaded file metadata after success
 *   accept    (obj) — react-dropzone accept config (default: all files)
 */
function FileUpload({ onSuccess, accept }) {
  const [files,    setFiles]    = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((accepted) => {
    setFiles(prev => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept || undefined,
    multiple: true,
  });

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append('file', files[i]);
        await uploadFile(formData);
        successCount++;
      } catch (err) {
        toast.error(`Failed to upload ${files[i].name}: ${err.response?.data?.message || err.message}`);
      }
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully.`);
      setFiles([]);
      if (onSuccess) onSuccess();
    }
    setUploading(false);
    setProgress(0);
  };

  const fmt = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Drop zone */}
      <div {...getRootProps()} style={styles.zone(isDragActive)}>
        <input {...getInputProps()} />
        <div style={styles.icon}><FiUploadCloud size={40} /></div>
        <p style={styles.heading}>
          {isDragActive ? 'Drop files here…' : 'Drag & drop files, or click to browse'}
        </p>
        <p style={styles.sub}>Files are stored securely in AWS S3</p>
      </div>

      {/* Selected file list */}
      {files.length > 0 && (
        <div style={styles.fileList}>
          {files.map((f, i) => (
            <div key={i} style={styles.fileItem}>
              <FiFile size={16} color="#38bdf8" />
              <span style={styles.fileName}>{f.name}</span>
              <span style={styles.fileSize}>{fmt(f.size)}</span>
              {!uploading && (
                <button style={styles.removeBtn} onClick={() => removeFile(i)} title="Remove">
                  <FiX size={14} />
                </button>
              )}
            </div>
          ))}

          {/* Progress bar (during upload) */}
          {uploading && (
            <div style={styles.progress}>
              <div style={styles.progressBar(progress)} />
            </div>
          )}

          <button
            style={styles.uploadBtn}
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading
              ? `Uploading… ${progress}%`
              : `Upload ${files.length} file${files.length > 1 ? 's' : ''} to S3`}
          </button>
        </div>
      )}

      {/* Confirmation icon after upload */}
      {!uploading && progress === 100 && (
        <div style={{ marginTop: '12px', textAlign: 'center', color: '#22c55e' }}>
          <FiCheckCircle size={20} style={{ marginRight: 6 }} />
          Upload complete
        </div>
      )}
    </div>
  );
}

export default FileUpload;
