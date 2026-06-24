import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { getCalendar, type CalendarData } from '../../lib/api';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCalendar(year, month)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const firstDayOfWeek = data ? new Date(year, month - 1, 1).getDay() : 0;
  const examDate = data?.examDate || '2026-10-19';

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📅 Calendário Inteligente</h1>
          <p>Apenas dias úteis contam — feriados e fins de semana são excluídos automaticamente</p>
        </div>

        {/* Stats row */}
        <div className="grid-3" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="stat-card card-accent">
            <span className="stat-label">📅 Dias Úteis Restantes</span>
            <span className="stat-value" style={{ color: data && data.remainingWorkdays < 20 ? 'var(--error)' : data && data.remainingWorkdays < 40 ? 'var(--warning)' : 'var(--success)' }}>
              {data?.remainingWorkdays ?? '—'}
            </span>
            <span className="stat-sub">até {examDate}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">✅ Dias Estudados</span>
            <span className="stat-value">
              {data ? data.days.filter(d => d.isStudied).length : '—'}
            </span>
            <span className="stat-sub">neste mês</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">📊 Dias Úteis no Mês</span>
            <span className="stat-value">
              {data ? data.days.filter(d => d.isWorkday).length : '—'}
            </span>
            <span className="stat-sub">disponíveis para estudo</span>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          {/* Calendar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth} id="btn-prev-month">◀</button>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{MONTH_NAMES[month - 1]} {year}</h2>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth} id="btn-next-month">▶</button>
          </div>

          {/* Day headers */}
          <div className="calendar-grid" style={{ marginBottom: 'var(--space-2)' }}>
            {DAY_NAMES.map(d => (
              <div key={d} className="calendar-header-cell">{d}</div>
            ))}
          </div>

          {/* Calendar days */}
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <div className="calendar-grid">
              {/* Empty cells for first week */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {data?.days.map(day => {
                const isExam = day.date === examDate;
                let cls = 'calendar-day';
                if (isExam) cls += ' exam-day';
                else if (day.isStudied) cls += ' studied';
                else if (day.isToday) cls += ' today';
                else if (day.isHoliday) cls += ' holiday';
                else if (!day.isWorkday) cls += ' weekend';
                else cls += ' workday';

                return (
                  <div key={day.date} className={cls} title={
                    isExam ? '🎯 DIA DO CONCURSO!'
                    : day.isStudied ? '✅ Estudado'
                    : day.isHoliday ? '🎉 Feriado'
                    : day.isToday ? '📌 Hoje'
                    : !day.isWorkday ? 'Fim de semana'
                    : 'Dia útil'
                  }>
                    {day.dayOfMonth}
                    {isExam && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--error)' }} />}
                    {day.isStudied && !isExam && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--success)' }} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {[
              { cls: 'workday', label: 'Dia útil' },
              { cls: 'today', label: 'Hoje' },
              { cls: 'studied', label: 'Estudado' },
              { cls: 'holiday', label: 'Feriado' },
              { cls: 'exam-day', label: 'Concurso' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className={`calendar-day ${l.cls}`} style={{ width: 20, height: 20, fontSize: 10, borderRadius: 'var(--radius-sm)' }}>•</div>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exam countdown */}
        <div className="card" style={{ marginTop: 'var(--space-6)', maxWidth: 600, margin: 'var(--space-6) auto 0' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-4)' }}>🎯 Contagem Regressiva</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              color: data && data.remainingWorkdays < 20 ? 'var(--error)' : 'var(--accent-hover)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {data?.remainingWorkdays ?? '—'}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>dias úteis restantes</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {data && data.remainingWorkdays > 0
                  ? `Concurso em ${examDate} — aproveite cada dia útil!`
                  : 'O concurso já passou. Parabéns pela dedicação!'}
              </div>
            </div>
          </div>
          {data && data.remainingWorkdays > 0 && (
            <div style={{ marginTop: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', fontSize: 13, color: 'var(--text-secondary)' }}>
              💡 Com 1h/dia útil, você ainda tem <strong style={{ color: 'var(--text-primary)' }}>{data.remainingWorkdays}h</strong> de estudo disponíveis!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
