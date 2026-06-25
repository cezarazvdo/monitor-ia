import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import MermaidChart from '../../components/MermaidChart';
import {
  startSession, generatePreReading, generateQuestions,
  submitAnswer, completeSession, explainError,
  type Question, type StudySession,
} from '../../lib/api';

type Phase = 'setup' | 'pre_reading' | 'quiz' | 'correction' | 'complete';

const DISCIPLINES = [
  { key: 'legislacao', label: 'Legislação', emoji: '⚖️', color: 'var(--legislacao)' },
  { key: 'logica', label: 'Lógica', emoji: '🧠', color: 'var(--logica)' },
  { key: 'matematica', label: 'Matemática', emoji: '📐', color: 'var(--matematica)' },
  { key: 'informatica', label: 'Informática', emoji: '💻', color: 'var(--informatica)' },
  { key: 'portugues', label: 'Português', emoji: '📖', color: 'var(--portugues)' },
];

const TOPICS: Record<string, string[]> = {
  legislacao: ['LGPD — Lei Geral de Proteção de Dados', 'ISO/IEC 27001 — SGSI', 'ISO/IEC 27002 — Controles', 'Marco Civil da Internet', 'Decreto 10.046/2019', 'Lei de Acesso à Informação'],
  logica: ['Lógica Proposicional', 'Silogismo Categórico', 'Lógica de Argumentação', 'Diagramas Lógicos', 'Tabela-Verdade', 'Equivalências Lógicas'],
  matematica: ['Porcentagem e Razão', 'Regra de Três', 'Progressões (PA e PG)', 'Probabilidade Básica', 'Equações e Inequações', 'Matemática Financeira'],
  informatica: ['Segurança da Informação', 'Redes de Computadores', 'Sistemas Operacionais', 'Banco de Dados', 'Excel e LibreOffice Calc', 'Internet e E-mail'],
  portugues: ['Interpretação de Texto', 'Concordância Verbal', 'Concordância Nominal', 'Regência Verbal', 'Crase', 'Pontuação'],
};

export default function StudyPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [discipline, setDiscipline] = useState('legislacao');
  const [topic, setTopic] = useState(TOPICS.legislacao[0]);
  const [session, setSession] = useState<StudySession | null>(null);
  const [preReadingContent, setPreReadingContent] = useState('');
  const [preReadingSources, setPreReadingSources] = useState<{ name: string; type: string }[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; correctAnswer: string; explanation: string } | null>(null);
  const [wrongAnswers, setWrongAnswers] = useState<{ question: Question; userAnswer: string; explanation: string }[]>([]);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [startTime] = useState(Date.now());
  const [qStartTime, setQStartTime] = useState(Date.now());
  const [correctCount, setCorrectCount] = useState(0);
  const [detailedExplanation, setDetailedExplanation] = useState<string | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTopic(TOPICS[discipline][0]);
  }, [discipline]);

  // Phase 1 → Start session + generate pre-reading
  async function handleStartSession() {
    setLoading(true);
    try {
      const s = await startSession({ discipline, topic });
      setSession({
        id: s.sessionId,
        discipline: s.discipline,
        topic: s.topic,
        date: s.date,
        phase: 'pre_reading',
        status: 'active',
      });
      const pr = await generatePreReading({ discipline, topic, sessionId: s.sessionId });
      setPreReadingContent(pr.content);
      setPreReadingSources(pr.sources || []);
      if (pr.apiWarning) setApiWarning(pr.apiWarning);
      else setApiWarning(null);
      setPhase('pre_reading');
    } catch (e: any) {
      alert('Erro ao iniciar sessão: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // Phase 2 → Generate questions
  async function handleStartQuiz() {
    setLoading(true);
    try {
      const result = await generateQuestions({
        discipline,
        topic,
        content: preReadingContent,
        count: 10,
        sessionId: session?.id,
        difficulty: 2,
      });
      setQuestions(result.questions);
      if (result.apiWarning) setApiWarning(result.apiWarning);
      setCurrentQ(0);
      setPhase('quiz');
      setQStartTime(Date.now());
    } catch (e: any) {
      alert('Erro ao gerar questões: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // Submit answer
  async function handleAnswer(letter: string) {
    if (selectedAnswer || !session) return;
    setSelectedAnswer(letter);

    const timeTaken = Math.round((Date.now() - qStartTime) / 1000);
    const q = questions[currentQ];

    try {
      const result = await submitAnswer(session.id, {
        questionId: q.id,
        selectedAnswer: letter,
        timeTaken,
      });
      setAnswerResult(result);

      const gained = result.xpGained || (result.isCorrect ? 10 : 0);
      setSessionXP(p => p + gained);
      if (result.isCorrect) setCorrectCount(p => p + 1);
      else {
        setWrongAnswers(prev => [...prev, { question: q, userAnswer: letter, explanation: result.explanation }]);
      }
    } catch {
      // Local fallback
      const correct = q.correct || q.correct_answer || '';
      const isCorrect = letter === correct;
      setAnswerResult({ isCorrect, correctAnswer: correct, explanation: q.explanation });
      if (isCorrect) { setSessionXP(p => p + 10); setCorrectCount(p => p + 1); }
      else setWrongAnswers(prev => [...prev, { question: q, userAnswer: letter, explanation: q.explanation }]);
    }
  }

  // Next question
  function handleNextQuestion() {
    setSelectedAnswer(null);
    setAnswerResult(null);
    setDetailedExplanation(null);
    if (currentQ + 1 >= questions.length) {
      // Session complete XP bonus
      const bonus = correctCount === questions.length ? 200 : 100;
      const total = sessionXP + bonus;
      setSessionXP(total);
      setXpEarned(total);
      setPhase(wrongAnswers.length > 0 ? 'correction' : 'complete');
    } else {
      setCurrentQ(p => p + 1);
      setQStartTime(Date.now());
    }
  }

  const [correctionLoading, setCorrectionLoading] = useState<Record<string, boolean>>({});

  // Get detailed AI explanation for wrong answer
  async function handleGetExplanation(q: Question, userAnswer: string, isActiveCorrection = false) {
    if (isActiveCorrection) {
      setCorrectionLoading(p => ({ ...p, [q.id]: true }));
    } else {
      setLoadingExplain(true);
    }
    
    try {
      const res = await explainError({ questionId: q.id, userAnswer, discipline });
      
      if (!isActiveCorrection) {
        setDetailedExplanation(res.explanation);
      }
      
      // Sempre salvar na lista de erros para uso posterior
      setWrongAnswers(prev => prev.map(wa => 
        wa.question.id === q.id ? { ...wa, explanation: res.explanation } : wa
      ));
    } catch {
      if (!isActiveCorrection) {
        setDetailedExplanation(q.explanation || 'Revise o conteúdo sobre este tópico.');
      }
    } finally {
      if (isActiveCorrection) {
        setCorrectionLoading(p => ({ ...p, [q.id]: false }));
      } else {
        setLoadingExplain(false);
      }
    }
  }

  // Complete session
  async function handleComplete() {
    if (!session) return;
    const duration = Math.round((Date.now() - startTime) / 1000);
    try {
      await completeSession(session.id, { xpEarned, durationSeconds: duration });
    } catch {/* ignore */ }
    setPhase('complete');
  }

  const q = questions[currentQ];
  const progress = questions.length > 0 ? ((currentQ + (answerResult ? 1 : 0)) / questions.length) * 100 : 0;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">

        {apiWarning && (
          <div style={{
            background: 'var(--error-dim)',
            color: 'var(--error)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius)',
            marginBottom: 'var(--space-4)',
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            maxWidth: 800,
            margin: '0 auto var(--space-6) auto'
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span>
              <strong>Aviso da IA:</strong> Não foi possível acessar o modelo (Tokens esgotados ou alta demanda). O sistema carregou conteúdo de demonstração local para você não interromper os estudos. 
              <br/><span style={{ opacity: 0.8, fontSize: 12 }}>Detalhes: {apiWarning}</span>
            </span>
            <button 
              onClick={() => setApiWarning(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', marginLeft: 'auto', padding: 4 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* PHASE: SETUP */}
        {phase === 'setup' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="page-header">
              <h1>📚 Nova Sessão de Estudo</h1>
              <p>Escolha a disciplina e o tópico para esta sessão</p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-5)' }}>Disciplina</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                {DISCIPLINES.map(d => (
                  <button
                    key={d.key}
                    id={`discipline-${d.key}`}
                    onClick={() => setDiscipline(d.key)}
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: discipline === d.key ? `2px solid ${d.color}` : '1.5px solid var(--border)',
                      background: discipline === d.key ? `rgba(${d.color === 'var(--legislacao)' ? '129,140,248' : d.color === 'var(--logica)' ? '52,211,153' : d.color === 'var(--matematica)' ? '251,146,60' : d.color === 'var(--informatica)' ? '56,189,248' : '244,114,182'}, 0.1)` : 'var(--bg-elevated)',
                      cursor: 'pointer',
                      transition: 'all var(--transition)',
                      textAlign: 'center',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{d.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>Tópico</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {(TOPICS[discipline] || []).map(t => (
                  <button
                    key={t}
                    id={`topic-${t.replace(/\s/g, '-')}`}
                    onClick={() => setTopic(t)}
                    className={`quiz-option${topic === t ? ' selected' : ''}`}
                  >
                    <span className="option-letter" style={{ background: topic === t ? 'var(--accent)' : undefined, color: topic === t ? 'white' : undefined }}>
                      ✓
                    </span>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                <span>⏱️ ~45 minutos</span>
                <span>📝 10 questões</span>
                <span>🎯 +100–300 XP</span>
                <span>📖 Pré-leitura inclusa</span>
              </div>
            </div>

            <button className="btn btn-primary btn-lg w-full" id="btn-start-session" onClick={handleStartSession} disabled={loading}>
              {loading ? '⏳ Iniciando...' : '🚀 Começar Sessão'}
            </button>
          </div>
        )}

        {/* PHASE: PRE-READING */}
        {phase === 'pre_reading' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="phase-indicator">
              <div className="phase-step active">
                <div className="phase-dot">1</div>
                <span>Pré-leitura</span>
              </div>
              <div className="phase-connector" />
              <div className="phase-step">
                <div className="phase-dot">2</div>
                <span>Questões</span>
              </div>
              <div className="phase-connector" />
              <div className="phase-step">
                <div className="phase-dot">3</div>
                <span>Correção</span>
              </div>
            </div>

            <div className="card-accent" style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <span className={`discipline-badge discipline-${discipline}`}>
                  {DISCIPLINES.find(d => d.key === discipline)?.emoji} {DISCIPLINES.find(d => d.key === discipline)?.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>📖 ~5 min de leitura</span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99,102,241,0.15)',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  🤖 Conteúdo Sintetizado por IA
                </span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-1)' }}>{topic}</h2>
              {preReadingSources.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  📚 <strong>Fontes utilizadas:</strong> {preReadingSources.map(s => s.name).join(', ')}
                </div>
              )}
            </div>

            <div className="card" ref={contentRef} style={{ marginBottom: 'var(--space-6)', lineHeight: 1.8 }}>
              {preReadingContent ? (
                <div className="markdown-content">
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeVal = String(children).replace(/\n$/, '');
                        if (match && match[1] === 'mermaid') {
                          return <MermaidChart chart={codeVal} />;
                        }
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {preReadingContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="loading-center"><div className="spinner" /></div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setPhase('setup')}>← Voltar</button>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} id="btn-start-quiz" onClick={handleStartQuiz} disabled={loading}>
                {loading ? '⏳ Gerando questões...' : 'Ir para Questões →'}
              </button>
            </div>
          </div>
        )}

        {/* PHASE: QUIZ */}
        {phase === 'quiz' && q && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="phase-indicator">
              <div className="phase-step done">
                <div className="phase-dot">✓</div>
                <span>Pré-leitura</span>
              </div>
              <div className="phase-connector" />
              <div className="phase-step active">
                <div className="phase-dot">2</div>
                <span>Questões</span>
              </div>
              <div className="phase-connector" />
              <div className="phase-step">
                <div className="phase-dot">3</div>
                <span>Correção</span>
              </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Questão {currentQ + 1} de {questions.length}</span>
                <span>✅ {correctCount} corretas · 🎯 {sessionXP} XP</span>
              </div>
              <div className="progress-bar" style={{ height: 6 }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Question card */}
            <div className="card-accent" style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <span className={`discipline-badge discipline-${discipline}`}>
                  {DISCIPLINES.find(d => d.key === discipline)?.emoji} {topic}
                </span>
                
                {/* AI vs Copy badge & citation */}
                {(() => {
                  const src = q.source || 'ai';
                  if (src.startsWith('copy:')) {
                    return (
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(16,185,129,0.15)',
                        color: 'var(--success)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }} title="Questão oficial copiada de prova anterior">
                        📝 Questão Oficial · <span style={{ textDecoration: 'underline' }}>{src.slice(5)}</span>
                      </span>
                    );
                  } else if (src.startsWith('ai:')) {
                    return (
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(99,102,241,0.15)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }} title="Questão gerada por IA a partir de documento de prova/edital">
                        🤖 IA · <span style={{ textDecoration: 'underline' }}>Baseado em: {src.slice(3)}</span>
                      </span>
                    );
                  } else {
                    return (
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(99,102,241,0.15)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }} title="Questão elaborada por inteligência artificial">
                        🤖 Elaborada por IA
                      </span>
                    );
                  }
                })()}

                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {'⭐'.repeat(q.difficulty || 2)}
                </span>
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.7, fontWeight: 500 }}>{q.stem}</p>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              {Object.entries(q.options || {}).map(([letter, text]) => {
                const correct = q.correct || q.correct_answer || '';
                let cls = 'quiz-option';
                if (selectedAnswer) {
                  if (letter === correct) cls += ' correct';
                  else if (letter === selectedAnswer) cls += ' incorrect';
                }
                return (
                  <button
                    key={letter}
                    id={`option-${letter}`}
                    className={cls}
                    onClick={() => handleAnswer(letter)}
                    disabled={!!selectedAnswer}
                  >
                    <span className="option-letter">{letter}</span>
                    <span>{text}</span>
                  </button>
                );
              })}
            </div>

            {/* Answer feedback */}
            {answerResult && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  background: answerResult.isCorrect ? 'var(--success-dim)' : 'var(--error-dim)',
                  border: `1px solid ${answerResult.isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  marginBottom: 'var(--space-4)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: answerResult.isCorrect ? 'var(--success)' : 'var(--error)',
                }}>
                  {answerResult.isCorrect ? '✅ Correto! +10 XP' : `❌ Incorreto — Resposta: ${answerResult.correctAnswer}`}
                </div>

                {answerResult.explanation && (
                  <div className="explanation-box">
                    <strong style={{ color: 'var(--text-primary)' }}>💡 Explicação:</strong>
                    <p style={{ marginTop: 8 }}>{answerResult.explanation}</p>
                  </div>
                )}

                {!answerResult.isCorrect && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 'var(--space-3)' }}
                    onClick={() => handleGetExplanation(q, selectedAnswer!)}
                    disabled={loadingExplain}
                  >
                    {loadingExplain ? '⏳ Buscando...' : '🤖 Explicação detalhada com IA'}
                  </button>
                )}

                {detailedExplanation && (
                  <div className="explanation-box" style={{ marginTop: 'var(--space-3)', borderLeftColor: 'var(--accent)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>🤖 Análise detalhada:</strong>
                    <p style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{detailedExplanation}</p>
                  </div>
                )}

                <button className="btn btn-primary w-full" style={{ marginTop: 'var(--space-5)' }} id="btn-next-question" onClick={handleNextQuestion}>
                  {currentQ + 1 >= questions.length ? '🏁 Finalizar Questões' : 'Próxima Questão →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* PHASE: CORRECTION */}
        {phase === 'correction' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="phase-indicator">
              <div className="phase-step done"><div className="phase-dot">✓</div><span>Pré-leitura</span></div>
              <div className="phase-connector" />
              <div className="phase-step done"><div className="phase-dot">✓</div><span>Questões</span></div>
              <div className="phase-connector" />
              <div className="phase-step active"><div className="phase-dot">3</div><span>Correção Ativa</span></div>
            </div>

            <div className="page-header">
              <h1>🔍 Correção Ativa</h1>
              <p>Revise os {wrongAnswers.length} {wrongAnswers.length === 1 ? 'item que você errou' : 'itens que você errou'}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {wrongAnswers.map((wa, i) => (
                <div key={i} className="card" style={{ borderLeft: '3px solid var(--error)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Questão {i + 1} de {wrongAnswers.length}
                    </span>
                    
                    {(() => {
                      const src = wa.question.source || 'ai';
                      if (src.startsWith('copy:')) {
                        return (
                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(16,185,129,0.15)',
                            color: 'var(--success)',
                            fontWeight: 600,
                          }}>
                            📝 Oficial ({src.slice(5)})
                          </span>
                        );
                      } else if (src.startsWith('ai:')) {
                        return (
                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99,102,241,0.15)',
                            color: 'var(--accent)',
                            fontWeight: 600,
                          }}>
                            🤖 IA ({src.slice(3)})
                          </span>
                        );
                      } else {
                        return (
                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99,102,241,0.15)',
                            color: 'var(--accent)',
                            fontWeight: 600,
                          }}>
                            🤖 IA
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 'var(--space-4)', fontWeight: 500 }}>
                    {wa.question.stem}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 13, marginBottom: 'var(--space-4)' }}>
                    <span style={{ background: 'var(--error-dim)', color: 'var(--error)', padding: '6px 12px', borderRadius: 'var(--radius)', fontWeight: 600, alignSelf: 'flex-start', lineHeight: 1.5 }}>
                      ❌ Sua resposta: {wa.userAnswer} - {wa.question.options?.[wa.userAnswer]}
                    </span>
                    <span style={{ background: 'var(--success-dim)', color: 'var(--success)', padding: '6px 12px', borderRadius: 'var(--radius)', fontWeight: 600, alignSelf: 'flex-start', lineHeight: 1.5 }}>
                      ✅ Correta: {wa.question.correct || wa.question.correct_answer} - {wa.question.options?.[(wa.question.correct || wa.question.correct_answer || '') as string]}
                    </span>
                  </div>
                  <div className="explanation-box">
                    <strong style={{ color: 'var(--text-primary)' }}>💡 Por quê?</strong>
                    <p style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{wa.explanation || 'Revise o conteúdo sobre este tópico.'}</p>
                    
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 'var(--space-3)' }}
                      onClick={() => handleGetExplanation(wa.question, wa.userAnswer, true)}
                      disabled={correctionLoading[wa.question.id]}
                    >
                      {correctionLoading[wa.question.id] ? '⏳ Analisando erro...' : '🤖 Aprofundar explicação do erro com IA'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-primary btn-lg w-full" style={{ marginTop: 'var(--space-8)' }} id="btn-complete-session" onClick={handleComplete}>
              🏆 Concluir Sessão e Receber XP
            </button>
          </div>
        )}

        {/* PHASE: COMPLETE */}
        {phase === 'complete' && (
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingTop: 'var(--space-12)' }}>
            <div style={{ fontSize: 72, marginBottom: 'var(--space-6)' }}>
              {correctCount === questions.length ? '🏆' : correctCount >= questions.length * 0.7 ? '⭐' : '💪'}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 'var(--space-3)' }}>
              {correctCount === questions.length ? 'Perfeito!' : correctCount >= questions.length * 0.7 ? 'Ótimo trabalho!' : 'Continue praticando!'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 'var(--space-8)' }}>
              {correctCount}/{questions.length} questões corretas
            </p>

            <div className="card" style={{ marginBottom: 'var(--space-6)', textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="stat-card" style={{ background: 'var(--bg-elevated)' }}>
                  <span className="stat-label">XP Ganho</span>
                  <span className="stat-value" style={{ fontSize: 28, color: 'var(--accent-hover)' }}>+{xpEarned}</span>
                </div>
                <div className="stat-card" style={{ background: 'var(--bg-elevated)' }}>
                  <span className="stat-label">Taxa de Acerto</span>
                  <span className="stat-value" style={{ fontSize: 28 }}>
                    {questions.length > 0 ? Math.round(correctCount / questions.length * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setPhase('setup'); setWrongAnswers([]); setSessionXP(0); setCorrectCount(0); setXpEarned(0); }}>
                Nova Sessão
              </button>
              <Link to="/" className="btn btn-primary" style={{ flex: 1 }}>
                🏠 Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
