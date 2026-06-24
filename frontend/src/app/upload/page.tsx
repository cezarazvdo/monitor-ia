import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Sidebar from '../../components/Sidebar';
import { getDocuments, uploadDocument, deleteDocument, analyzeExams, type Document } from '../../lib/api';
import { useEffect } from 'react';

const DOC_TYPES = [
  { key: 'prova', label: '📝 Prova', desc: 'Provas anteriores (p1, p2)' },
  { key: 'gabarito', label: '✅ Gabarito', desc: 'Gabaritos oficiais (g1, g2)' },
  { key: 'edital', label: '📋 Edital', desc: 'Conteúdo programático' },
  { key: 'apoio', label: '📖 Material de Apoio', desc: 'Artigos, anotações, resumos' },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    done: { label: '✅ Processado', color: 'var(--success)', bg: 'var(--success-dim)' },
    processing: { label: '⏳ Processando...', color: 'var(--warning)', bg: 'var(--warning-dim)' },
    error: { label: '❌ Erro', color: 'var(--error)', bg: 'var(--error-dim)' },
  } as any;
  const s = map[status] || map.processing;
  return (
    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: s.bg, color: s.color, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

export default function UploadPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedType, setSelectedType] = useState('apoio');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const loadDocs = () => getDocuments().then(setDocs).catch(console.error);
  useEffect(() => { loadDocs(); }, []);

  // Auto-refresh processing docs
  useEffect(() => {
    const processingDocs = docs.filter(d => d.status === 'processing');
    if (processingDocs.length === 0) return;
    const timer = setTimeout(loadDocs, 3000);
    return () => clearTimeout(timer);
  }, [docs]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setUploadFeedback(null);
    try {
      for (const file of acceptedFiles) {
        await uploadDocument(file, selectedType);
        setUploadFeedback(`✅ "${file.name}" enviado com sucesso! +20 XP`);
      }
      loadDocs();
    } catch (e: any) {
      setUploadFeedback(`❌ Erro: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }, [selectedType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    multiple: true,
    disabled: uploading,
  });

  async function handleDelete(id: string) {
    if (!confirm('Remover este documento?')) return;
    await deleteDocument(id);
    loadDocs();
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeExams();
      setAnalysisResult(result);
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const provas = docs.filter(d => d.type === 'prova' || d.type === 'gabarito');

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📁 Documentos</h1>
          <p>Upload de provas, gabaritos, edital e materiais de apoio para enriquecer o conteúdo de IA</p>
        </div>

        {/* Type selector */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>Tipo de Documento</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
            {DOC_TYPES.map(t => (
              <button
                key={t.key}
                id={`type-${t.key}`}
                onClick={() => setSelectedType(t.key)}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: selectedType === t.key ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  background: selectedType === t.key ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div {...getRootProps()} className={`dropzone${isDragActive ? ' active' : ''}`} style={{ marginBottom: 'var(--space-6)' }}>
          <input {...getInputProps()} id="file-upload-input" />
          <div className="dropzone-icon">📤</div>
          <div className="dropzone-title">
            {uploading ? 'Enviando...' : isDragActive ? 'Solte os arquivos aqui!' : 'Arraste arquivos ou clique para selecionar'}
          </div>
          <div className="dropzone-sub">PDF, TXT, MD — máximo 50MB por arquivo</div>
          {uploadFeedback && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius)',
              background: uploadFeedback.startsWith('✅') ? 'var(--success-dim)' : 'var(--error-dim)',
              color: uploadFeedback.startsWith('✅') ? 'var(--success)' : 'var(--error)',
              fontSize: 14,
              fontWeight: 500,
            }}>
              {uploadFeedback}
            </div>
          )}
        </div>

        {/* Analyze exams button */}
        {provas.length >= 2 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🔍 Analisar Provas com IA</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {provas.filter(d => d.status === 'done').length} provas/gabaritos prontos para análise
              </div>
            </div>
            <button className="btn btn-primary" id="btn-analyze-exams" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? '⏳ Analisando...' : '🤖 Analisar Padrões'}
            </button>
          </div>
        )}

        {/* Analysis results */}
        {analysisResult && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: '3px solid var(--accent)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>🎯 Análise das Provas</h2>
            {analysisResult.topTopics && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Tópicos Mais Cobrados
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {analysisResult.topTopics.map((t: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 13, padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
                      <span style={{ color: 'var(--text-tertiary)', width: 20 }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{t.topic}</span>
                      <span className={`discipline-badge discipline-${t.discipline?.toLowerCase()}`}>{t.discipline}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>×{t.frequency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {analysisResult.recommendations && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Recomendações
                </h3>
                <ul style={{ paddingLeft: 'var(--space-5)', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {analysisResult.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Document list */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-5)' }}>
            📂 Documentos Carregados ({docs.length})
          </h2>
          {docs.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">📭</div>
              <h3>Nenhum documento ainda</h3>
              <p>Faça upload das provas p1, p2 e gabaritos g1, g2 para começar!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {docs.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 28 }}>
                    {doc.type === 'prova' ? '📝' : doc.type === 'gabarito' ? '✅' : doc.type === 'edital' ? '📋' : '📖'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.originalName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                  <button
                    id={`btn-delete-${doc.id}`}
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(doc.id)}
                    style={{ color: 'var(--error)', flexShrink: 0 }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
