import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Download, Trash2, FileIcon, Loader2, Clock, ChevronDown, ChevronUp, Eye, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const API_BASE = '';

const ALLOWED_TYPES = {
  'application/pdf': { ext: 'pdf', label: 'PDF', icon: FileText, color: '#ef4444' },
  'application/msword': { ext: 'doc', label: 'Word', icon: FileText, color: '#2563eb' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', label: 'Word', icon: FileText, color: '#2563eb' },
  'application/vnd.ms-excel': { ext: 'xls', label: 'Excel', icon: FileText, color: '#16a34a' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', label: 'Excel', icon: FileText, color: '#16a34a' },
  'image/jpeg': { ext: 'jpg', label: 'Imagen', icon: ImageIcon, color: '#a855f7' },
  'image/png': { ext: 'png', label: 'Imagen', icon: ImageIcon, color: '#a855f7' },
  'image/webp': { ext: 'webp', label: 'Imagen', icon: ImageIcon, color: '#a855f7' }
};

const MAX_SIZE_MB = 25;

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(d) {
  const dt = new Date(d);
  return dt.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export interface DocumentoItem {
  id: number;
  caso_id: string;
  estado: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  size_stored: number;
  compressed: boolean;
  version: number;
  is_current: boolean;
  uploaded_by: string;
  uploaded_by_nombre: string | null;
  created_at: string;
}

interface DocumentosPorEtapaProps {
  casoId: string;
  etapaActual: string;
  theme?: 'light' | 'dark';
  onDocumentosChange?: () => void;
}

export const DocumentosPorEtapa: React.FC<DocumentosPorEtapaProps> = ({
  casoId,
  etapaActual,
  theme = 'light',
  onDocumentosChange
}) => {
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expandedEtapas, setExpandedEtapas] = useState<Record<string, boolean>>({ [etapaActual]: true });
  const [versionsModal, setVersionsModal] = useState<{ filename: string; versions: DocumentoItem[] } | null>(null);
  const [previewModal, setPreviewModal] = useState<DocumentoItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentoItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textTertiary = isDark ? '#64748b' : '#94a3b8';

  const getAuthHeaders = () => {
    const user = api.getUser();
    return {
      'X-User-Id': user?.id || '',
      'X-User-Role': user?.role || '',
      'X-User-Email': user?.email || '',
      'X-User-Pais': user?.pais || ''
    };
  };

  const loadDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos`, {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocumentos(data.documentos || []);
    } catch (e) {
      console.error('Error cargando documentos:', e);
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, [casoId]);

  useEffect(() => { loadDocumentos(); }, [loadDocumentos]);

  const validateFile = (file: File): string | null => {
    if (!(file.type in ALLOWED_TYPES)) {
      return `Tipo no permitido: ${file.type}. Solo PDF, Word, Excel, JPG, PNG, WebP.`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Excede el límite de ${MAX_SIZE_MB}MB`;
    }
    return null;
  };

  const uploadFile = async (file: File, estado: string) => {
    const err = validateFile(file);
    if (err) {
      setErrorMessage(err);
      return;
    }
    setUploading(true);
    try {
      const user = api.getUser();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('estado', estado);
      fd.append('uploaded_by', user?.id || '');
      fd.append('uploaded_by_nombre', user?.name || user?.nombre || '');

      const res = await fetch(`/api/casos/${casoId}/documentos`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: fd
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(t).message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      if (data.success) {
        await loadDocumentos();
        onDocumentosChange?.();
        if (data.message) setErrorMessage(data.message);
      } else {
        setErrorMessage(data.message || 'Error al subir');
      }
    } catch (e) {
      console.error('Error upload:', e);
      setErrorMessage('Error al subir: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(f => uploadFile(f, etapaActual));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(f => uploadFile(f, etapaActual));
    }
  };

  const handleDownload = async (doc: DocumentoItem) => {
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos/${doc.id}/download`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Error download:', e);
      setErrorMessage('Error al descargar: ' + (e as Error).message);
    }
  };

  const handlePreview = (doc: DocumentoItem) => {
    setPreviewModal(doc);
  };

  const handleDelete = async (doc: DocumentoItem) => {
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos/${doc.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al eliminar');
      setConfirmDelete(null);
      await loadDocumentos();
      onDocumentosChange?.();
    } catch (e) {
      setErrorMessage('Error al eliminar: ' + (e as Error).message);
    }
  };

  const showVersions = async (filename: string) => {
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos/versiones/${encodeURIComponent(filename)}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setVersionsModal({ filename, versions: data.documentos || [] });
    } catch (e) {
      setErrorMessage('Error al cargar versiones');
    }
  };

  const docsPorEtapa = documentos.reduce((acc, d) => {
    if (!acc[d.estado]) acc[d.estado] = [];
    acc[d.estado].push(d);
    return acc;
  }, {} as Record<string, DocumentoItem[]>);

  const etapaKeys = Object.keys(docsPorEtapa).sort();

  const DocRow: React.FC<{ doc: DocumentoItem; isCurrent: boolean }> = ({ doc, isCurrent }) => {
    const typeInfo = ALLOWED_TYPES[doc.mime_type as keyof typeof ALLOWED_TYPES] || { label: 'Archivo', icon: FileIcon, color: '#64748b' };
    const Icon = typeInfo.icon;
    const isImage = doc.mime_type.startsWith('image/');
    const isPdf = doc.mime_type === 'application/pdf';
    const canPreview = isImage || isPdf;
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm"
        style={{
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'
        }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
              {doc.filename}
            </p>
            {doc.version > 1 && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}
              >
                v{doc.version}
              </span>
            )}
            {doc.compressed && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
                title={`Comprimido: ${formatBytes(doc.size_bytes)} → ${formatBytes(doc.size_stored)}`}
              >
                {Math.round((1 - doc.size_stored / doc.size_bytes) * 100)}% ↓
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: textTertiary }}>
            {formatBytes(doc.size_bytes)} · {doc.uploaded_by_nombre || doc.uploaded_by} · {formatDate(doc.created_at)}
          </p>
        </div>
        {doc.version > 1 && (
          <button
            onClick={() => showVersions(doc.filename)}
            className="p-2 rounded-md transition-colors hover:bg-white/10"
            style={{ color: textSecondary }}
            title="Ver versiones"
          >
            <Clock className="w-4 h-4" />
          </button>
        )}
        {canPreview && (
          <button
            onClick={() => handlePreview(doc)}
            className="p-2 rounded-md transition-colors hover:bg-white/10"
            style={{ color: '#8b5cf6' }}
            title="Vista previa"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => handleDownload(doc)}
          className="p-2 rounded-md transition-colors hover:bg-white/10"
          style={{ color: '#3b82f6' }}
          title="Descargar"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={() => setConfirmDelete(doc)}
          className="p-2 rounded-md transition-colors hover:bg-white/10"
          style={{ color: '#ef4444' }}
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!previewModal) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/casos/${casoId}/documentos/${previewModal.id}/download?inline=1`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) {
          URL.revokeObjectURL(blob as any);
          return;
        }
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewLoading(false);
      } catch (e) {
        if (!cancelled) {
          setErrorMessage('No se pudo cargar: ' + (e as Error).message);
          setPreviewModal(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [previewModal?.id, casoId]);

  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary }}>
            Documentos
          </h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
            Archivos por etapa del caso
          </p>
        </div>
        <p className="text-xs font-medium" style={{ color: textSecondary }}>
          {documentos.length} archivo{documentos.length !== 1 ? 's' : ''} (max 25)
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="rounded-xl border-2 border-dashed p-4 mb-4 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragOver ? '#3b82f6' : (isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'),
          backgroundColor: dragOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2" style={{ color: textSecondary }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Subiendo...</span>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 mx-auto mb-1.5" style={{ color: dragOver ? '#3b82f6' : textSecondary }} />
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              Subir a etapa actual: <span style={{ color: '#3b82f6' }}>{etapaActual}</span>
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: textTertiary }}>
              Arrastra archivos o haz click · PDF, Word, Excel, imágenes · max 25MB
            </p>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Loader2 className="w-5 h-5 mx-auto animate-spin" style={{ color: textSecondary }} />
        </div>
      ) : etapaKeys.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: textTertiary }}>
          No hay documentos aún
        </p>
      ) : (
        <div className="space-y-3">
          {etapaKeys.map(estado => {
            const docs = docsPorEtapa[estado];
            const expanded = expandedEtapas[estado] !== false;
            return (
              <div key={estado}>
                <button
                  onClick={() => setExpandedEtapas(prev => ({ ...prev, [estado]: !expanded }))}
                  className="w-full flex items-center justify-between p-2 rounded-lg transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronUp className="w-4 h-4" style={{ color: textSecondary }} /> : <ChevronDown className="w-4 h-4" style={{ color: textSecondary }} />}
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: textPrimary }}>
                      {estado}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}
                    >
                      {docs.length}
                    </span>
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-2 mt-2 pl-2">
                    {docs.map(d => (
                      <DocRow key={d.id} doc={d} isCurrent={d.is_current} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Vista previa */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: cardBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{ borderColor: cardBorder }}
            >
              <div>
                <h3 className="text-base font-bold" style={{ color: textPrimary }}>
                  {previewModal.filename}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
                  {formatBytes(previewModal.size_bytes)} · {previewModal.mime_type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewModal)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5"
                  style={{ backgroundColor: '#3b82f6', color: '#fff' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="p-2 rounded-md"
                  style={{ color: textSecondary }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto" style={{ backgroundColor: isDark ? '#020617' : '#f1f5f9', minHeight: '400px' }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: '#3b82f6' }} />
                    <p className="text-sm font-medium" style={{ color: textSecondary }}>
                      Cargando vista previa...
                    </p>
                  </div>
                </div>
              ) : previewModal.mime_type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewModal.filename}
                  className="max-w-full max-h-[80vh] mx-auto block"
                  onError={() => setErrorMessage('No se pudo cargar la imagen')}
                />
              ) : previewModal.mime_type === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  title={previewModal.filename}
                  className="w-full"
                  style={{ height: 'calc(90vh - 80px)', minHeight: '600px', border: 'none' }}
                  onError={() => setErrorMessage('No se pudo cargar el PDF')}
                />
              ) : (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: textSecondary }} />
                  <p style={{ color: textPrimary }}>Vista previa no disponible para este tipo</p>
                  <button
                    onClick={() => handleDownload(previewModal)}
                    className="mt-3 px-4 py-2 rounded-md text-sm font-semibold"
                    style={{ backgroundColor: '#3b82f6', color: '#fff' }}
                  >
                    Descargar para ver
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminacion */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-md w-full"
            style={{ backgroundColor: cardBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: textPrimary }}>
                  Eliminar documento
                </h3>
                <p className="text-sm mt-1" style={{ color: textSecondary }}>
                  ¿Eliminar permanentemente <span style={{ color: textPrimary, fontWeight: 600 }}>"{confirmDelete.filename}"</span>?
                </p>
                <p className="text-xs mt-1" style={{ color: textTertiary }}>
                  Esta accion no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-md text-sm font-semibold"
                style={{
                  backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)',
                  color: textPrimary
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-md text-sm font-semibold text-white"
                style={{ backgroundColor: '#ef4444' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Error / Mensaje */}
      {errorMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setErrorMessage(null)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-md w-full"
            style={{ backgroundColor: cardBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-3" style={{ color: textPrimary }}>
              Información
            </h3>
            <p className="text-sm mb-4" style={{ color: textSecondary }}>
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 rounded-md text-sm font-semibold"
                style={{ backgroundColor: '#3b82f6', color: '#fff' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Versiones */}
      {versionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setVersionsModal(null)}
        >
          <div
            className="rounded-2xl border shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: textPrimary }}>
                Versiones: {versionsModal.filename}
              </h3>
              <button onClick={() => setVersionsModal(null)} style={{ color: textSecondary }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {versionsModal.versions.map(v => (
                <DocRow key={v.id} doc={v} isCurrent={v.is_current} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentosPorEtapa;
