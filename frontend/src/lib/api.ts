// frontend/src/lib/api.ts
const API_BASE = '/api';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Gamification / Profile ──────────────────────────────────────────────────
export const getProfile = () => fetchAPI<Profile>('/gamification/profile');
export const updateProfile = (data: Partial<Profile>) =>
  fetchAPI('/gamification/profile', { method: 'PUT', body: JSON.stringify(data) });
export const getStats = () => fetchAPI<Stats>('/gamification/stats');
export const getCalendar = (year: number, month: number) =>
  fetchAPI<CalendarData>(`/gamification/calendar?year=${year}&month=${month}`);

export const toggleCalendarDay = (date: string, isWorkday: boolean) =>
  fetchAPI<{ success: boolean; date: string; isWorkday: boolean }>('/gamification/calendar/toggle', {
    method: 'POST',
    body: JSON.stringify({ date, isWorkday }),
  });

// ─── Sessions ────────────────────────────────────────────────────────────────
export const startSession = (data: { discipline?: string; topic?: string }) =>
  fetchAPI<{ sessionId: string; discipline: string; topic: string; date: string }>(
    '/sessions/start', { method: 'POST', body: JSON.stringify(data) }
  );

export const completeSession = (sessionId: string, data: { xpEarned: number; durationSeconds: number }) =>
  fetchAPI('/sessions/' + sessionId + '/complete', { method: 'POST', body: JSON.stringify(data) });

export const submitAnswer = (sessionId: string, data: { questionId: string; selectedAnswer: string; timeTaken: number }) =>
  fetchAPI<{ isCorrect: boolean; correctAnswer: string; explanation: string; xpGained: number }>(
    '/sessions/' + sessionId + '/answer', { method: 'POST', body: JSON.stringify(data) }
  );

export const getTodaySession = () => fetchAPI<TodaySession>('/sessions/today');
export const getWeakTopics = () => fetchAPI<WeakTopic[]>('/sessions/weak-topics');

// ─── AI ──────────────────────────────────────────────────────────────────────
export const generatePreReading = (data: { discipline: string; topic: string; subtopic?: string; sessionId?: string }) =>
  fetchAPI<{
    content: string;
    apiWarning?: string;
    pipelineId?: string | null;
    qualityScore?: ContentQualityScore | null;
    stepsCompleted?: string[] | null;
    sources?: { name: string; url?: string; type: string }[];
  }>('/ai/pre-reading', { method: 'POST', body: JSON.stringify(data) });

export const generateQuestions = (data: { discipline: string; topic: string; content?: string; count?: number; sessionId?: string; difficulty?: number }) =>
  fetchAPI<{ questions: Question[]; apiWarning?: string }>('/ai/questions', { method: 'POST', body: JSON.stringify(data) });

export const explainError = (data: { questionId: string; userAnswer: string; discipline?: string }) =>
  fetchAPI<{ explanation: string }>('/ai/explain-error', { method: 'POST', body: JSON.stringify(data) });

export const analyzeExams = () => fetchAPI('/ai/analyze-exams', { method: 'POST' });

export const fixMermaid = (data: { chart: string }) =>
  fetchAPI<{ content: string; error?: string }>('/ai/fix-mermaid', { method: 'POST', body: JSON.stringify(data) });

export const getGenerationAudit = (id: string) =>
  fetchAPI<GenerationAudit>('/ai/generation/' + id);

export const getStudyContext = () =>
  fetchAPI<{
    hasAnalysis: boolean;
    banca: string;
    disciplineSummary: { discipline: string; topicCount: number; totalFrequency: number }[];
    topTopics: Record<string, { topic: string; frequency: number; difficulty: number }[]>;
  }>('/ai/study-context');


// ─── Documents ───────────────────────────────────────────────────────────────
export const getDocuments = () => fetchAPI<Document[]>('/documents');
export const deleteDocument = (id: string) => fetchAPI('/documents/' + id, { method: 'DELETE' });
export const uploadDocument = async (file: File, type: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  const res = await fetch(`${API_BASE}/documents/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload falhou');
  return res.json();
};

export const getSyllabus = () =>
  fetchAPI<{ content: string; savedAt: string | null; exists: boolean }>('/documents/syllabus');

export const saveSyllabus = (content: string) =>
  fetchAPI<{ success: boolean; chars?: number; deleted?: boolean }>('/documents/syllabus', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

export const invalidateAnalysisCache = () =>
  fetchAPI<{ success: boolean; removed: number }>('/ai/analyze-exams/cache', { method: 'DELETE' });

// ─── Search ──────────────────────────────────────────────────────────────────
export const searchWeb = (q: string, type?: string) =>
  fetchAPI<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}${type ? '&type=' + type : ''}`);

// ─── Health ──────────────────────────────────────────────────────────────────
export const getHealth = () => fetchAPI<HealthCheck>('/health');

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Profile {
  name: string;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  disciplineWeights: Record<string, number>;
  examDate: string;
  remainingWorkdays: number;
  totalPlannedWorkdays: number;
  banca: string;
  badges: Badge[];
  xpToNextLevel: number;
  levelProgress: number;
}

export interface Stats {
  byDiscipline: DisciplineStat[];
  dailyData: DailyLog[];
  weakTopics: WeakTopic[];
  todayAnswers: { total: number; correct: number };
  totals: { sessions: number; studyHours: number };
}

export interface DisciplineStat {
  discipline: string;
  total: number;
  correct: number;
  rate: number;
  avgTime: number;
}

export interface DailyLog {
  date: string;
  studied: number;
  xp_earned: number;
  questions_answered: number;
  correct_answers: number;
}

export interface WeakTopic {
  discipline: string;
  topic: string;
  error_count: number;
  attempt_count: number;
  error_rate: number;
}

export interface CalendarData {
  year: number;
  month: number;
  days: CalendarDay[];
  examDate: string;
  remainingWorkdays: number;
  totalPlannedWorkdays: number;
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  dayOfWeek: number;
  isWorkday: boolean;
  isHoliday: boolean;
  isStudied: boolean;
  isToday: boolean;
}

export interface TodaySession {
  session: StudySession | null;
  suggestedDiscipline: string;
  suggestedTopic: string;
  alreadyStudied: boolean;
}

export interface StudySession {
  id: string;
  date: string;
  discipline: string;
  topic: string;
  phase: string;
  status: string;
}

export interface Question {
  id: string;
  stem: string;
  options: Record<string, string>;
  correct: string;
  correct_answer?: string;
  explanation: string;
  difficulty: number;
  source?: string;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  type: string;
  size: number;
  status: 'done' | 'processing' | 'error';
  uploadedAt: string;
}

export interface Badge {
  id: string;
  badge_key: string;
  name: string;
  description: string;
  earned_at: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface HealthCheck {
  status: string;
  hasGemini: boolean;
  hasSerper: boolean;
  examDate: string;
}

export interface ContentQualityScore {
  factualAccuracy: number;
  clarity: number;
  syllabusCoverage: number;
  bancaAlignment: number;
  overallScore: number;
  feedback?: string;
}

export interface RagSource {
  title: string;
  url: string;
  snippet: string;
  source: string;
  queriedAt?: string;
}

export interface GenerationAudit {
  id: string;
  sessionId: string | null;
  discipline: string;
  topic: string;
  subtopic: string | null;
  modelUsed: string;
  pipelineSteps: string[];
  sourcesUsed: RagSource[];
  qualityScore: ContentQualityScore | null;
  durationMs: number;
  hadRevisionIssues: boolean;
  generatedAt: string;
}
