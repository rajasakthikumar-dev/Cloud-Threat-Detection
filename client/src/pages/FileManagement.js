import React, { useEffect, useState, useCallback } from 'react';
import {
  FiFolder,
  FiDownload,
  FiTrash2,
  FiSearch,
  FiEye,
  FiX,
  FiFileText,
  FiAlertCircle,
  FiRefreshCw,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import FileUpload from '../components/FileUpload';
import { getFiles, deleteFile, getFileUrl, getFilePreview, getFileContent } from '../services/api';

const layout = {
  wrapper: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:    { display: 'flex', flex: 1 },
  main:    { flex: 1, padding: '28px', overflow: 'auto' },
  heading: { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' },
  card:    { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' },
  cardTitle:{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: '16px' },
  searchBar:{ display: 'flex', alignItems: 'center', gap: '10px',
              background: '#0f172a', border: '1px solid #334155',
              borderRadius: '8px', padding: '8px 14px', marginBottom: '16px' },
  searchInput:{ flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#e2e8f0', fontSize: '14px' },
  th:  { padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#475569',
         textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' },
  td:  { padding: '11px 14px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid #1e293b' },
  btn: (color) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color, padding: '6px', display: 'inline-flex', borderRadius: '4px',
    transition: 'background 0.15s',
  }),
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modalContent: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '14px', width: '100%', maxWidth: '850px',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0f172a',
  },
  modalBody: {
    padding: '20px', overflow: 'auto', flex: 1, display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '300px',
  },
  modalFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderTop: '1px solid #334155', background: '#0f172a',
  },
  actionButton: (bg, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: 'none',
    background: bg, color: color, fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', transition: 'opacity 0.2s',
  }),
};

function fmt(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

function getFileTypeCategory(name = '', mimeType = '') {
  const ext = name.split('.').pop().toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/xml' ||
    ['txt', 'csv', 'json', 'log', 'md', 'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml', 'sql', 'sh', 'env', 'config'].includes(ext)
  ) {
    return 'text';
  }
  return 'unsupported';
}

export default function FileManagement() {
  const [files,         setFiles]         = useState([]);
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [previewFileState, setPreviewFileState] = useState(null); // Active file object
  const [previewUrl,    setPreviewUrl]    = useState('');
  const [previewContent,setPreviewContent]= useState('');
  const [previewLoading,setPreviewLoading]= useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await getFiles();
      setFiles(res.data.files || []);
    } catch (err) {
      toast.error('Failed to load files.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (key, name) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteFile(key);
      toast.success(`"${name}" deleted successfully.`);
      setFiles(prev => prev.filter(f => f.key !== key));
      if (previewFileState?.key === key) {
        closePreview();
      }
    } catch (err) {
      toast.error('Failed to delete file.');
    }
  };

  const handleDownload = async (key, name) => {
    try {
      const res = await getFileUrl(key);
      const a = document.createElement('a');
      a.href = res.data.url;
      a.download = name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error('Could not generate download link.');
    }
  };

  const handlePreview = async (file) => {
    setPreviewFileState(file);
    setPreviewUrl('');
    setPreviewContent('');
    setPreviewLoading(true);

    const cat = getFileTypeCategory(file.name, file.mimeType);

    try {
      if (cat === 'image' || cat === 'pdf') {
        const res = await getFilePreview(file.key);
        setPreviewUrl(res.data.url);
      } else if (cat === 'text') {
        const res = await getFileContent(file.key);
        setPreviewContent(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
      }
    } catch (err) {
      toast.error('Failed to load preview for this file.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFileState(null);
    setPreviewUrl('');
    setPreviewContent('');
    setPreviewLoading(false);
  };

  const handleUploadSuccess = () => {
    fetchFiles();
  };

  const filtered = files.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={layout.wrapper}>
      <Navbar />
      <div style={layout.body}>
        <Sidebar />
        <main style={layout.main}>
          <h1 style={layout.heading}>My Files</h1>
          <p style={layout.sub}>Upload, preview, and securely manage your private cloud documents.</p>

          <div style={layout.grid}>
            {/* Upload panel */}
            <div style={layout.card}>
              <p style={layout.cardTitle}>Upload File</p>
              <FileUpload onSuccess={handleUploadSuccess} />
            </div>

            {/* File list */}
            <div style={layout.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ ...layout.cardTitle, margin: 0 }}>Stored Files ({filtered.length})</p>
                <button
                  onClick={fetchFiles}
                  style={{ ...layout.btn('#38bdf8'), gap: '4px', fontSize: '12px' }}
                  title="Refresh file list"
                >
                  <FiRefreshCw size={14} /> Refresh
                </button>
              </div>

              <div style={layout.searchBar}>
                <FiSearch size={15} color="#475569" />
                <input
                  style={layout.searchInput}
                  placeholder="Search files by name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#0f172a' }}>
                    <tr>
                      {['Name', 'Size', 'Uploaded', 'Actions'].map(h => (
                        <th key={h} style={layout.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} style={{ ...layout.td, textAlign: 'center' }}>Loading files…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={4} style={{ ...layout.td, textAlign: 'center', color: '#475569' }}>
                        {search ? 'No files match your search.' : 'No files uploaded yet.'}
                      </td></tr>
                    ) : filtered.map((f, i) => (
                      <tr key={f.id || f.key || i} style={{ transition: 'background 0.15s' }}>
                        <td style={layout.td}>
                          <span
                            onClick={() => handlePreview(f)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              color: '#38bdf8',
                              fontWeight: 500,
                            }}
                            title="Click to preview file"
                          >
                            <FiFolder size={14} color="#38bdf8" />
                            {f.name}
                          </span>
                        </td>
                        <td style={layout.td}>{fmt(f.size)}</td>
                        <td style={layout.td}>{f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString() : '—'}</td>
                        <td style={layout.td}>
                          <span style={{ display: 'flex', gap: '6px' }}>
                            <button
                              style={layout.btn('#38bdf8')}
                              onClick={() => handlePreview(f)}
                              title="Preview file"
                            >
                              <FiEye size={15} />
                            </button>
                            <button
                              style={layout.btn('#22c55e')}
                              onClick={() => handleDownload(f.key, f.name)}
                              title="Download file"
                            >
                              <FiDownload size={15} />
                            </button>
                            <button
                              style={layout.btn('#ef4444')}
                              onClick={() => handleDelete(f.key, f.name)}
                              title="Delete file"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── SAME-PAGE INLINE PREVIEW MODAL ── */}
          {previewFileState && (
            <div style={layout.modalOverlay} onClick={closePreview}>
              <div style={layout.modalContent} onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div style={layout.modalHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiFileText size={18} color="#38bdf8" />
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                        {previewFileState.name}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {fmt(previewFileState.size)} • {previewFileState.mimeType || 'Unknown Type'}
                      </span>
                    </div>
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                    onClick={closePreview}
                    title="Close preview"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={layout.modalBody}>
                  {previewLoading ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                      <p>Loading file preview…</p>
                    </div>
                  ) : (
                    (() => {
                      const cat = getFileTypeCategory(previewFileState.name, previewFileState.mimeType);

                      if (cat === 'image' && previewUrl) {
                        return (
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <img
                              src={previewUrl}
                              alt={previewFileState.name}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '60vh',
                                objectFit: 'contain',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                              }}
                            />
                          </div>
                        );
                      }

                      if (cat === 'pdf' && previewUrl) {
                        return (
                          <iframe
                            src={previewUrl}
                            title={previewFileState.name}
                            style={{
                              width: '100%',
                              height: '60vh',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              background: '#fff',
                            }}
                          />
                        );
                      }

                      if (cat === 'text') {
                        return (
                          <pre
                            style={{
                              width: '100%',
                              maxHeight: '60vh',
                              overflow: 'auto',
                              background: '#0f172a',
                              color: '#e2e8f0',
                              padding: '16px',
                              borderRadius: '8px',
                              border: '1px solid #334155',
                              fontFamily: 'monospace',
                              fontSize: '13px',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              margin: 0,
                            }}
                          >
                            {previewContent || '(Empty file content)'}
                          </pre>
                        );
                      }

                      return (
                        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#94a3b8' }}>
                          <FiAlertCircle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
                          <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                            This file cannot be previewed in the browser.
                          </h4>
                          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 20px' }}>
                            Browser previews are supported for Images (PNG, JPG, SVG, WebP, GIF), PDFs, and Text/Code documents. You can still download this file to your device.
                          </p>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Modal Footer */}
                <div style={layout.modalFooter}>
                  <button
                    style={layout.actionButton('#dc2626', '#fff')}
                    onClick={() => handleDelete(previewFileState.key, previewFileState.name)}
                  >
                    <FiTrash2 size={14} /> Delete
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      style={layout.actionButton('#334155', '#e2e8f0')}
                      onClick={closePreview}
                    >
                      Close
                    </button>
                    <button
                      style={layout.actionButton('#0284c7', '#fff')}
                      onClick={() => handleDownload(previewFileState.key, previewFileState.name)}
                    >
                      <FiDownload size={14} /> Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

