import React, { useEffect, useState, useCallback } from 'react';
import {
  FiFolder, FiDownload, FiTrash2, FiSearch, FiEye, FiX,
  FiFileText, FiAlertCircle, FiRefreshCw, FiImage, FiCode,
  FiFile, FiCloud,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import FileUpload from '../components/FileUpload';
import { getFiles, deleteFile, getFileUrl, getFilePreview, getFileContent } from '../services/api';

/* ── All handlers identical to original ─────────────────────── */

function fmt(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

function getFileTypeCategory(name = '', mimeType = '') {
  const ext  = name.split('.').pop().toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript' || mime === 'application/xml' ||
      ['txt','csv','json','log','md','js','jsx','ts','tsx','py','html','css','xml','yaml','yml','sql','sh','env','config'].includes(ext)) return 'text';
  return 'unsupported';
}

function getFileIcon(name = '', mimeType = '') {
  const cat = getFileTypeCategory(name, mimeType);
  if (cat === 'image') return <FiImage size={16} color="#0ea5e9" />;
  if (cat === 'pdf')   return <FiFileText size={16} color="#ef4444" />;
  if (cat === 'text')  return <FiCode size={16} color="#8b5cf6" />;
  return <FiFile size={16} color="#64748b" />;
}

/* ── Glass styles ───────────────────────────────────────────── */
const gc = (extra = {}) => ({
  background:'rgba(255,255,255,0.22)',
  backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
  border:'1px solid rgba(255,255,255,0.35)',
  borderRadius:'16px',
  boxShadow:'0 4px 20px rgba(2,132,199,0.10)',
  ...extra,
});

export default function FileManagement() {
  const [files,          setFiles]          = useState([]);
  const [search,         setSearch]         = useState('');
  const [loading,        setLoading]        = useState(true);
  const [previewFileState, setPreviewFileState] = useState(null);
  const [previewUrl,     setPreviewUrl]     = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await getFiles();
      setFiles(res.data.files || []);
    } catch { toast.error('Failed to load files.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleDelete = async (key, name) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteFile(key);
      toast.success(`"${name}" deleted.`);
      setFiles(prev => prev.filter(f => f.key !== key));
      if (previewFileState?.key === key) closePreview();
    } catch { toast.error('Failed to delete file.'); }
  };

  const handleDownload = async (key, name) => {
    try {
      const res = await getFileUrl(key);
      const a = document.createElement('a');
      a.href = res.data.url; a.download = name; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { toast.error('Could not generate download link.'); }
  };

  const handlePreview = async (file) => {
    setPreviewFileState(file); setPreviewUrl(''); setPreviewContent(''); setPreviewLoading(true);
    const cat = getFileTypeCategory(file.name, file.mimeType);
    try {
      if (cat === 'image' || cat === 'pdf') {
        const res = await getFilePreview(file.key);
        setPreviewUrl(res.data.url);
      } else if (cat === 'text') {
        const res = await getFileContent(file.key);
        setPreviewContent(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
      }
    } catch { toast.error('Failed to load preview.'); }
    finally { setPreviewLoading(false); }
  };

  const closePreview = () => { setPreviewFileState(null); setPreviewUrl(''); setPreviewContent(''); setPreviewLoading(false); };
  const handleUploadSuccess = () => { fetchFiles(); };

  const filtered = files.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));

  const iconBtn = (color, onClick, title, Icon) => (
    <button
      onClick={onClick} title={title}
      style={{ background:`${color}18`, border:`1px solid ${color}30`, borderRadius:'8px', color, padding:'6px 8px', cursor:'pointer', display:'inline-flex', alignItems:'center', transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background=`${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.background=`${color}18`; }}
    >
      <Icon size={14} />
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 40%, #93c5fd 80%, #60a5fa 100%)' }}>
      <Navbar />
      <div style={{ display:'flex', flex:1 }}>
        <Sidebar />
        <main style={{ flex:1, padding:'28px', overflow:'auto' }}>

          {/* Header */}
          <div style={{ marginBottom:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
              <div style={{ width:'38px', height:'38px', borderRadius:'11px', background:'linear-gradient(135deg, #0ea5e9, #0284c7)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(14,165,233,0.35)' }}>
                <FiCloud size={18} color="#fff" />
              </div>
              <h1 style={{ fontSize:'22px', fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' }}>My Files</h1>
            </div>
            <p style={{ fontSize:'14px', color:'rgba(15,23,42,0.55)', fontWeight:500 }}>Upload, preview, and securely manage your private cloud documents.</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:'20px', alignItems:'start' }}>

            {/* Upload panel */}
            <div style={gc({ padding:'20px' })}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'rgba(15,23,42,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'16px' }}>Upload File</p>
              <FileUpload onSuccess={handleUploadSuccess} />
            </div>

            {/* File list */}
            <div style={gc({ padding:'20px' })}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                <p style={{ fontSize:'11px', fontWeight:700, color:'rgba(15,23,42,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>
                  Stored Files ({filtered.length})
                </p>
                <button
                  onClick={fetchFiles}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(14,165,233,0.12)', border:'1px solid rgba(14,165,233,0.25)', borderRadius:'8px', color:'#0369a1', padding:'5px 10px', fontSize:'12px', fontWeight:600, cursor:'pointer' }}
                >
                  <FiRefreshCw size={12} /> Refresh
                </button>
              </div>

              {/* Search */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.45)', border:'1px solid rgba(14,165,233,0.20)', borderRadius:'10px', padding:'8px 12px', marginBottom:'16px' }}>
                <FiSearch size={14} color="rgba(15,23,42,0.4)" />
                <input
                  style={{ flex:1, background:'none', border:'none', outline:'none', color:'#0f172a', fontSize:'13px', fontFamily:'inherit' }}
                  placeholder="Search files by name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Table */}
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'rgba(15,23,42,0.04)' }}>
                      {['Name','Size','Uploaded','Actions'].map(h => (
                        <th key={h} style={{ padding:'10px 14px', fontSize:'11px', fontWeight:700, color:'rgba(15,23,42,0.40)', textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} style={{ padding:'28px', textAlign:'center', color:'rgba(15,23,42,0.4)', fontSize:'13px' }}>Loading files…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding:'28px', textAlign:'center', color:'rgba(15,23,42,0.35)', fontSize:'13px' }}>
                        {search ? 'No files match your search.' : 'No files uploaded yet.'}
                      </td></tr>
                    ) : filtered.map((f, i) => (
                      <tr key={f.id || f.key || i} style={{ borderTop:'1px solid rgba(15,23,42,0.06)', transition:'background 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(14,165,233,0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}
                      >
                        <td style={{ padding:'11px 14px' }}>
                          <span
                            onClick={() => handlePreview(f)}
                            style={{ display:'inline-flex', alignItems:'center', gap:'8px', cursor:'pointer', color:'#0369a1', fontWeight:600, fontSize:'13px' }}
                            title="Click to preview"
                          >
                            {getFileIcon(f.name, f.mimeType)}
                            {f.name}
                          </span>
                        </td>
                        <td style={{ padding:'11px 14px', fontSize:'12px', color:'rgba(15,23,42,0.45)' }}>{fmt(f.size)}</td>
                        <td style={{ padding:'11px 14px', fontSize:'12px', color:'rgba(15,23,42,0.45)' }}>{f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString() : '—'}</td>
                        <td style={{ padding:'11px 14px' }}>
                          <span style={{ display:'flex', gap:'6px' }}>
                            {iconBtn('#0ea5e9', () => handlePreview(f),        'Preview',  FiEye)}
                            {iconBtn('#22c55e', () => handleDownload(f.key, f.name), 'Download', FiDownload)}
                            {iconBtn('#ef4444', () => handleDelete(f.key, f.name),  'Delete',   FiTrash2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── PREVIEW MODAL — identical logic, new visual style ── */}
          {previewFileState && (
            <div
              onClick={closePreview}
              style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px', animation:'fadeIn 0.2s ease' }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{ background:'rgba(255,255,255,0.30)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.45)', borderRadius:'20px', width:'100%', maxWidth:'860px', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 30px 60px rgba(2,132,199,0.25)', animation:'scaleIn 0.2s ease' }}
              >
                {/* Modal header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.30)', background:'rgba(255,255,255,0.15)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    {getFileIcon(previewFileState.name, previewFileState.mimeType)}
                    <div>
                      <h3 style={{ fontSize:'15px', fontWeight:700, color:'#0f172a', margin:0 }}>{previewFileState.name}</h3>
                      <span style={{ fontSize:'12px', color:'rgba(15,23,42,0.45)' }}>{fmt(previewFileState.size)} • {previewFileState.mimeType || 'Unknown Type'}</span>
                    </div>
                  </div>
                  <button onClick={closePreview} style={{ background:'rgba(15,23,42,0.08)', border:'none', borderRadius:'8px', color:'rgba(15,23,42,0.5)', cursor:'pointer', padding:'6px', display:'flex' }}>
                    <FiX size={18} />
                  </button>
                </div>

                {/* Modal body */}
                <div style={{ padding:'20px', overflow:'auto', flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'300px' }}>
                  {previewLoading ? (
                    <p style={{ color:'rgba(15,23,42,0.5)', fontSize:'13px' }}>Loading preview…</p>
                  ) : (() => {
                    const cat = getFileTypeCategory(previewFileState.name, previewFileState.mimeType);
                    if (cat === 'image' && previewUrl) return (
                      <div style={{ width:'100%', display:'flex', justifyContent:'center' }}>
                        <img src={previewUrl} alt={previewFileState.name} style={{ maxWidth:'100%', maxHeight:'60vh', objectFit:'contain', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.40)', boxShadow:'0 8px 24px rgba(2,132,199,0.15)' }} />
                      </div>
                    );
                    if (cat === 'pdf' && previewUrl) return (
                      <iframe src={previewUrl} title={previewFileState.name} style={{ width:'100%', height:'60vh', border:'1px solid rgba(255,255,255,0.40)', borderRadius:'10px', background:'#fff' }} />
                    );
                    if (cat === 'text') return (
                      <pre style={{ width:'100%', maxHeight:'60vh', overflow:'auto', background:'rgba(15,23,42,0.06)', color:'#0f172a', padding:'16px', borderRadius:'10px', border:'1px solid rgba(15,23,42,0.10)', fontFamily:'monospace', fontSize:'13px', lineHeight:'1.5', whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>
                        {previewContent || '(Empty file content)'}
                      </pre>
                    );
                    return (
                      <div style={{ textAlign:'center', padding:'30px 20px', color:'rgba(15,23,42,0.55)' }}>
                        <FiAlertCircle size={48} color="#f59e0b" style={{ marginBottom:'16px' }} />
                        <h4 style={{ fontSize:'16px', fontWeight:700, color:'#0f172a', marginBottom:'8px' }}>This file cannot be previewed in the browser.</h4>
                        <p style={{ fontSize:'13px', color:'rgba(15,23,42,0.45)', maxWidth:'420px', margin:'0 auto 20px' }}>
                          Browser previews are supported for Images, PDFs, and Text/Code documents. Download this file to your device instead.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Modal footer */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 22px', borderTop:'1px solid rgba(255,255,255,0.30)', background:'rgba(255,255,255,0.15)' }}>
                  <button
                    onClick={() => handleDelete(previewFileState.key, previewFileState.name)}
                    style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'rgba(239,68,68,0.12)', color:'#dc2626', fontSize:'13px', fontWeight:600, cursor:'pointer' }}
                  >
                    <FiTrash2 size={14} /> Delete
                  </button>
                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={closePreview} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'1px solid rgba(15,23,42,0.15)', background:'transparent', color:'rgba(15,23,42,0.6)', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
                      Close
                    </button>
                    <button
                      onClick={() => handleDownload(previewFileState.key, previewFileState.name)}
                      style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg, #0ea5e9, #0284c7)', color:'#fff', fontSize:'13px', fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(14,165,233,0.30)' }}
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
