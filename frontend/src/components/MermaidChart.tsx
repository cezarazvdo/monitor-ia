import { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import Modal from './Modal';
import { fixMermaid } from '../lib/api';

// Configurar o tema Mermaid
mermaid.initialize({
  startOnLoad: false, // Desativar carregamento automático no DOM
  theme: 'base',
  securityLevel: 'loose',
  themeVariables: {
    background: '#131924', // var(--bg-elevated)
    
    // Nós
    primaryColor: '#1a2233', // var(--bg-surface)
    primaryBorderColor: '#7b2cbf', // var(--accent)
    primaryTextColor: '#f8f9fa', // var(--text)
    
    // Conexões
    lineColor: '#5a6b8c', // var(--text-tertiary)
    arrowheadColor: '#5a6b8c',
    
    // Fontes
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    
    // Variáveis adicionais para garantir que o tema base aplique o estilo dark
    nodeBorder: '1.5px solid #7b2cbf',
    mainBkg: '#1a2233',
    textColor: '#f8f9fa',
    border1: '#7b2cbf',
  }
});

interface MermaidChartProps {
  chart: string;
}

export default function MermaidChart({ chart }: MermaidChartProps) {
  const [currentChart, setCurrentChart] = useState<string>(chart);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCorrecting, setIsCorrecting] = useState<boolean>(false);
  const [correctionError, setCorrectionError] = useState<string>('');
  const chartIdRef = useRef<string>(`mermaid-${Math.floor(Math.random() * 1000000)}`);

  // Sanitizar a sintaxe do Mermaid
  const sanitizeMermaid = (code: string) => {
    if (!code) return '';
    
    // 1. Limpar marcações markdown
    let clean = code.replace(/```mermaid/g, '').replace(/```/g, '').trim();

    // 2. Processar linha por linha para garantir sintaxe válida dos nós
    clean = clean.split('\n').map(line => {
      // Ignorar comentários ou linhas vazias
      if (line.trim().startsWith('%%') || line.trim() === '') {
        return line;
      }

      let parsedLine = line;

      // Balancear colchetes
      let openBrackets = (parsedLine.match(/\[/g) || []).length;
      let closeBrackets = (parsedLine.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        parsedLine = parsedLine + ']'.repeat(openBrackets - closeBrackets);
      }

      // Balancear parênteses
      let openParens = (parsedLine.match(/\(/g) || []).length;
      let closeParens = (parsedLine.match(/\)/g) || []).length;
      if (openParens > closeParens) {
        parsedLine = parsedLine + ')'.repeat(openParens - closeParens);
      }

      const formatNode = (match: string, prefix: string, id: string, openDelim: string, text: string, closeDelim: string) => {
        const cleanText = text.replace(/"/g, '').trim();
        return `${prefix}${id}${openDelim}"${cleanText}"${closeDelim}`;
      };

      // Regex para nós no início da linha ou após setas (--> , --- , ==> etc.)
      
      // 1. Delimitadores retangulares: [texto]
      const bracketRegex = /(^|-->|---|==>)\s*([a-zA-Z0-9_-]+)\s*\[([^\]\n]+)\]/g;
      parsedLine = parsedLine.replace(bracketRegex, (match, prefix, id, text) => {
        return formatNode(match, prefix, id, '[', text, ']');
      });

      // 2. Delimitadores arredondados: (texto)
      const parenRegex = /(^|-->|---|==>)\s*([a-zA-Z0-9_-]+)\s*\(([^)\n]+)\)/g;
      parsedLine = parsedLine.replace(parenRegex, (match, prefix, id, text) => {
        return formatNode(match, prefix, id, '(', text, ')');
      });

      // 3. Delimitadores de decisão: {texto}
      const braceRegex = /(^|-->|---|==>)\s*([a-zA-Z0-9_-]+)\s*\{([^}\n]+)\}/g;
      parsedLine = parsedLine.replace(braceRegex, (match, prefix, id, text) => {
        return formatNode(match, prefix, id, '{', text, '}');
      });

      return parsedLine;
    }).join('\n');

    return clean;
  };

  const cleanChart = sanitizeMermaid(currentChart);

  // Reiniciar estado se a prop chart mudar
  useEffect(() => {
    setCurrentChart(chart);
    setError(false);
    setCorrectionError('');
  }, [chart]);

  useEffect(() => {
    let isMounted = true;
    setError(false);

    async function renderChart() {
      if (!cleanChart) return;
      try {
        const { svg } = await mermaid.render(chartIdRef.current, cleanChart);
        if (isMounted) {
          setSvgHtml(svg);
        }
      } catch (err) {
        console.error('[MERMAID] Falha ao renderizar gráfico:', err);
        if (isMounted) {
          setError(true);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [cleanChart]);

  const handleReload = () => {
    setError(false);
    setCorrectionError('');
    chartIdRef.current = `mermaid-${Math.floor(Math.random() * 1000000)}`;
    setCurrentChart(prev => prev + ' '); // Força atualização do estado para disparar render
  };

  const handleFixWithAI = async () => {
    setIsCorrecting(true);
    setCorrectionError('');
    try {
      const res = await fixMermaid({ chart: currentChart });
      if (res.error) {
        setCorrectionError(res.error);
      } else if (res.content) {
        chartIdRef.current = `mermaid-${Math.floor(Math.random() * 1000000)}`;
        setCurrentChart(res.content);
        setError(false);
      }
    } catch (err: any) {
      setCorrectionError(err.message || 'Erro ao conectar ao servidor para corrigir o diagrama.');
    } finally {
      setIsCorrecting(false);
    }
  };

  if (error) {
    return (
      <div 
        style={{
          margin: 'var(--space-6) 0',
          padding: 'var(--space-6)',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'var(--error)'
        }} />
        
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '20px', lineHeight: '1' }}>⚠️</span>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Erro de visualização no mapa mental
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              O diagrama gerado contém inconsistências de sintaxe e não pôde ser renderizado graficamente.
            </p>
          </div>
        </div>

        {correctionError && (
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--error)', 
            background: 'var(--error-dim)', 
            padding: 'var(--space-2) var(--space-3)', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(239, 68, 68, 0.15)'
          }}>
            ❌ {correctionError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleFixWithAI}
            disabled={isCorrecting}
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              boxShadow: '0 4px 12px var(--accent-glow)'
            }}
          >
            {isCorrecting ? (
              <>
                <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} />
                <span>Corrigindo com IA...</span>
              </>
            ) : (
              <>
                <span>✨ Corrigir com IA</span>
              </>
            )}
          </button>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleReload}
            disabled={isCorrecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}
          >
            <span>🔄 Recarregar</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="mermaid-wrapper" 
        style={{
          margin: 'var(--space-6) 0',
          padding: 'var(--space-5)',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          overflowX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)'
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          width: '100%',
          alignSelf: 'flex-start' 
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            🗺️ Mapa Mental do Conteúdo
          </div>
          {svgHtml && (
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2) var(--space-3)',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              Ampliar Mapa
            </button>
          )}
        </div>
        {svgHtml ? (
          <div 
            className="mermaid" 
            dangerouslySetInnerHTML={{ __html: svgHtml }} 
            style={{ width: '100%', textAlign: 'center' }}
          />
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 'var(--space-3)' }}>
            ⏳ Carregando mapa mental...
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="🗺️ Mapa Mental do Conteúdo"
      >
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-elevated)' }}>
          <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            Dica: Use a rodinha do mouse para dar zoom. Clique e arraste para navegar pelo mapa mental.
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <TransformWrapper
              initialScale={1}
              minScale={0.2}
              maxScale={4}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                <div 
                  className="mermaid" 
                  dangerouslySetInnerHTML={{ __html: svgHtml }} 
                  style={{ 
                    padding: 'var(--space-8)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    minWidth: '100%',
                    minHeight: '100%'
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      </Modal>
    </>
  );
}
