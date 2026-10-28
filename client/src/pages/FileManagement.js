import React, { useEffect, useState, useCallback } from 'react';
import {
  FiDownload, FiTrash2, FiSearch, FiEye, FiX,
  FiFileText, FiAlertCircle, FiRefreshCw, FiImage, FiCode,
  FiFile, FiCloud, FiShield, FiRotateCcw,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import FileUpload from '../components/FileUpload';
import { getFiles, deleteFile, getFileUrl, getFilePreview, getFileContent, verifyFileIntegrity, recoverFile } from '../services/api';

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
  const [verifying,      setVerifying]      = useState(null);
  const [recovering,     setRecovering]     = useState(null);
  const [verificationResults, setVerificationResults] = useState({});
  const [mismatchDialog, setMismatchDialog] = useState(null);

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
      
      // Clear verification results for deleted file
      setVerificationResults(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      
      if (previewFileState?.key === key) closePreview();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to delete file.';
      toast.error(errorMsg);
    }
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

  const handleVerifyIntegrity = async (file) => {
    setVerifying(file.key);
    try {
      const res = await verifyFileIntegrity(file.key);
      const verification = res.data.verification;
      
      // Store verification result for this file
      setVerificationResults(prev => ({
        ...prev,
        [file.key]: verification
      }));
      
      if (verification.match) {
        toast.success(`✓ ${file.name} — Integrity Verified`, { autoClose: 4000 });
      } else if (verification.noBlockchainRecord) {
        // File has no blockchain record - inform user but don't show as mismatch
        toast.warning(`⚠ ${file.name} — No blockchain integrity record found. File was uploaded before blockchain integration.`, { autoClose: 6000 });
      } else {
        // Show mismatch dialog
        setMismatchDialog({
          file,
          verification
        });
        toast.error(`✗ ${file.name} — Integrity Alert: Hash Mismatch!`, { autoClose: 6000 });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Verification failed';
      
      // Handle specific error cases
      if (errorMsg.includes('No blockchain record') || errorMsg.includes('not found on blockchain')) {
        toast.warning(`⚠ ${file.name} — ${errorMsg}`, { autoClose: 6000 });
      } else {
        toast.error(`✗ Verification failed: ${errorMsg}`, { autoClose: 6000 });
      }
      
      // Clear any stored verification result on error
      setVerificationResults(prev => {
        const updated = { ...prev };
        delete updated[file.key];
        return updated;
      });
    } finally {
      setVerifying(null);
    }
  };

  const handleRecover = async (file) => {
    setRecovering(file.key);
    setMismatchDialog(null); // Close dialog
    
    try {
      await recoverFile(file.key);
      toast.success(`✓ ${file.name} recovered successfully!`, { autoClose: 5000 });
      
      // Clear verification result and refresh file list
      setVerificationResults(prev => {
        const updated = { ...prev };
        delete updated[file.key];
        return updated;
      });
      
      await fetchFiles();
      
      // Optionally re-verify after recovery
      setTimeout(async () => {
        try {
          const verifyRes = await verifyFileIntegrity(file.key);
          if (verifyRes.data.verification.match) {
            toast.success(`✓ ${file.name} re-verified successfully`, { autoClose: 3000 });
          }
        } catch (err) {
          console.error('Re-verification failed:', err);
        }
      }, 1000);
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Recovery failed';
      toast.error(`Recovery failed: ${errorMsg}`, { autoClose: 7000 });
    } finally {
      setRecovering(null);
    }
  };

  const filtered = files.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));

  const actionBtn = (color, onClick, label, Icon, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ 
        background: disabled ? 'rgba(100,116,139,0.1)' : `${color}18`, 
        border: `1px solid ${disabled ? 'rgba(100,116,139,0.2)' : `${color}30`}`, 
        borderRadius: '8px', 
        color: disabled ? 'rgba(100,116,139,0.5)' : color, 
        padding: '8px 12px', 
        cursor: disabled ? 'not-allowed' : 'pointer', 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '6px',
        fontSize: '13px',
        fontWeight: 600,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background=`${color}30`; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background=`${color}18`; }}
    >
      <Icon size={14} />
      <span>{label}</span>
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
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                            {actionBtn('#0ea5e9', () => handlePreview(f), 'View', FiEye)}
                            {actionBtn('#22c55e', () => handleDownload(f.key, f.name), 'Download', FiDownload)}
                            {/* Show Verify button for all files - let backend determine if verification is possible */}
                            {actionBtn(
                              '#8b5cf6',
                              () => handleVerifyIntegrity(f),
                              verifying === f.key ? 'Verifying...' : 'Verify Integrity',
                              FiShield,
                              verifying === f.key
                            )}
                            {verificationResults[f.key]?.recoveryEligible && actionBtn(
                              '#f59e0b',
                              () => handleRecover(f),
                              recovering === f.key ? 'Recovering...' : 'Recover',
                              FiRotateCcw,
                              recovering === f.key
                            )}
                            {actionBtn('#ef4444', () => handleDelete(f.key, f.name), 'Delete', FiTrash2)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── INTEGRITY MISMATCH DIALOG ── */}
          {mismatchDialog && (
            <div
              onClick={() => setMismatchDialog(null)}
              style={{ 
                position: 'fixed', 
                inset: 0, 
                background: 'rgba(15,23,42,0.7)', 
                backdropFilter: 'blur(8px)', 
                WebkitBackdropFilter: 'blur(8px)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                zIndex: 1000, 
                padding: '20px' 
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{ 
                  background: 'rgba(255,255,255,0.95)', 
                  backdropFilter: 'blur(24px)', 
                  WebkitBackdropFilter: 'blur(24px)', 
                  border: '2px solid #dc2626', 
                  borderRadius: '20px', 
                  width: '100%', 
                  maxWidth: '560px', 
                  boxShadow: '0 30px 60px rgba(220,38,38,0.3)' 
                }}
              >
                {/* Dialog header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '24px 28px', 
                  borderBottom: '1px solid rgba(220,38,38,0.2)', 
                  background: 'rgba(254,202,202,0.3)' 
                }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'rgba(220,38,38,0.15)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <FiAlertCircle size={28} color="#dc2626" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      File Integrity Check Failed
                    </h3>
                    <p style={{ fontSize: '13px', color: 'rgba(15,23,42,0.6)', margin: '4px 0 0 0' }}>
                      {mismatchDialog.file.name}
                    </p>
                  </div>
                </div>

                {/* Dialog body */}
                <div style={{ padding: '24px 28px' }}>
                  <p style={{ fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '16px' }}>
                    The current file hash does not match the original blockchain integrity record. 
                    The file may have been <strong>modified or corrupted</strong>.
                  </p>
                  
                  {mismatchDialog.verification?.recoveryEligible ? (
                    <div style={{ 
                      background: 'rgba(234,179,8,0.1)', 
                      border: '1px solid rgba(234,179,8,0.3)', 
                      borderRadius: '12px', 
                      padding: '16px', 
                      marginBottom: '20px' 
                    }}>
                      <p style={{ fontSize: '14px', color: '#854d0e', margin: 0, lineHeight: '1.5' }}>
                        <strong>Recovery Available:</strong> A verified original version is available. 
                        You can restore the file to its blockchain-verified state.
                      </p>
                    </div>
                  ) : (
                    <div style={{ 
                      background: 'rgba(220,38,38,0.1)', 
                      border: '1px solid rgba(220,38,38,0.3)', 
                      borderRadius: '12px', 
                      padding: '16px', 
                      marginBottom: '20px' 
                    }}>
                      <p style={{ fontSize: '14px', color: '#7f1d1d', margin: 0, lineHeight: '1.5' }}>
                        <strong>Recovery Unavailable:</strong> No verified original version found. 
                        Recovery is not possible for this file.
                      </p>
                    </div>
                  )}

                  {/* Hash comparison */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Hash Comparison
                    </p>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#0f172a', background: 'rgba(15,23,42,0.05)', padding: '12px', borderRadius: '8px', wordBreak: 'break-all' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Blockchain:</span><br />
                        {mismatchDialog.verification?.storedSha256?.substring(0, 32)}...
                      </div>
                      <div>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Current:</span><br />
                        {mismatchDialog.verification?.currentSha256?.substring(0, 32)}...
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '14px', color: 'rgba(15,23,42,0.7)', fontWeight: 500, marginBottom: '20px' }}>
                    Would you like to restore the original file from the verified backup?
                  </p>
                </div>

                {/* Dialog footer */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '20px 28px', 
                  borderTop: '1px solid rgba(15,23,42,0.1)', 
                  background: 'rgba(248,250,252,0.8)' 
                }}>
                  <button
                    onClick={() => setMismatchDialog(null)}
                    style={{ 
                      flex: 1,
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '6px', 
                      padding: '12px 20px', 
                      borderRadius: '10px', 
                      border: '1px solid rgba(15,23,42,0.2)', 
                      background: 'transparent', 
                      color: 'rgba(15,23,42,0.7)', 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Cancel
                  </button>
                  {mismatchDialog.verification?.recoveryEligible && (
                    <button
                      onClick={() => handleRecover(mismatchDialog.file)}
                      disabled={recovering === mismatchDialog.file.key}
                      style={{ 
                        flex: 1,
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '8px', 
                        padding: '12px 20px', 
                        borderRadius: '10px', 
                        border: 'none', 
                        background: recovering === mismatchDialog.file.key 
                          ? 'rgba(234,179,8,0.5)' 
                          : 'linear-gradient(135deg, #f59e0b, #d97706)', 
                        color: '#fff', 
                        fontSize: '14px', 
                        fontWeight: 700, 
                        cursor: recovering === mismatchDialog.file.key ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.3)' 
                      }}
                    >
                      <FiRotateCcw size={16} />
                      {recovering === mismatchDialog.file.key ? 'Restoring...' : 'Restore Original File'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

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
