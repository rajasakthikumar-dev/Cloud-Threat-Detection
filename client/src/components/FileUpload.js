import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFile, FiX, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { uploadFile } from '../services/api';

/**
 * FileUpload — drag-and-drop uploader.
 * Props: onSuccess(fn), accept(obj)
 * All logic identical to original — only visual styles changed.
 */
function FileUpload({ onSuccess, accept }) {
  const [files,     setFiles]     = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);

  const onDrop = useCallback((accepted) => {
    setFiles(prev => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept || undefined,
    multiple: true,
  });

  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

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
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#06b6d4' : 'rgba(56, 189, 248, 0.35)'}`,
          borderRadius: '16px',
          padding: '40px 28px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive
            ? 'rgba(6, 182, 212, 0.12)'
            : 'rgba(30, 41, 59, 0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.25s',
        }}
      >
        <input {...getInputProps()} />
        <div style={{
          width: '60px', height: '60px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(139, 92, 246, 0.25))',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          color: '#22d3ee',
          boxShadow: '0 4px 18px rgba(6, 182, 212, 0.25)',
        }}>
          <FiUploadCloud size={30} />
        </div>
        <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>
          {isDragActive ? 'Drop files here…' : 'Drag & drop files, or click to browse'}
        </p>
        <p style={{ fontSize: '0.9375rem', color: 'rgba(148, 163, 184, 0.75)' }}>
          Files are stored securely in AWS S3
        </p>
      </div>

      {/* Selected file list */}
      {files.length > 0 && (
        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '12px 16px',
              backdropFilter: 'blur(12px)',
            }}>
              <FiFile size={18} color="#06b6d4" />
              <span style={{ flex: 1, fontSize: '1rem', color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: '0.875rem', color: 'rgba(148, 163, 184, 0.75)' }}>{fmt(f.size)}</span>
              {!uploading && (
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(203, 213, 225, 0.5)', padding: '2px', display: 'flex' }}
                  onClick={() => removeFile(i)}
                  title="Remove"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          ))}

          {/* Progress bar */}
          {uploading && (
            <div style={{ height: '6px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '999px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
                transition: 'width 0.3s',
                borderRadius: '999px',
                boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)',
              }} />
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              marginTop: '6px',
              width: '100%',
              padding: '14px',
              background: uploading ? 'rgba(6, 182, 212, 0.4)' : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1.0625rem',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s',
              boxShadow: uploading ? 'none' : '0 6px 20px rgba(6, 182, 212, 0.4)',
            }}
          >
            {uploading ? `Uploading… ${progress}%` : `Upload ${files.length} file${files.length > 1 ? 's' : ''} to S3`}
          </button>
        </div>
      )}

      {!uploading && progress === 100 && (
        <div style={{ marginTop: '16px', textAlign: 'center', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600 }}>
          <FiCheckCircle size={18} /> Upload complete
        </div>
      )}
    </div>
  );
}

export default FileUpload;
