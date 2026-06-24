import { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';

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
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
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

  const cleanChart = sanitizeMermaid(chart);

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

  if (error) {
    return (
      <div 
        style={{
          margin: 'var(--space-6) 0',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--error-dim)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--error)',
          fontSize: 13,
          color: 'var(--error)',
          lineHeight: 1.6
        }}
      >
        ⚠️ **Erro de visualização no mapa mental**: O diagrama continha inconsistências de sintaxe e não pôde ser renderizado graficamente.
      </div>
    );
  }

  return (
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
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1.5, alignSelf: 'flex-start' }}>
        🗺️ Mapa Mental do Conteúdo
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
  );
}
