// Cálculo de dias úteis (segunda a sexta, excluindo feriados nacionais)
const FERIADOS_2026 = [
  '2026-01-01', // Confraternização Universal
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência
  '2026-10-12', // N. Sra. Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Consciência Negra
  '2026-12-25', // Natal
];

function isHoliday(date) {
  const dateStr = date.toISOString().split('T')[0];
  return FERIADOS_2026.includes(dateStr);
}

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = domingo, 6 = sábado
}

function getCustomOverrides() {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const rows = db.prepare('SELECT date, is_workday FROM custom_calendar_days').all();
    const overrides = {};
    rows.forEach(row => {
      overrides[row.date] = row.is_workday;
    });
    return overrides;
  } catch (e) {
    return {};
  }
}

function isWorkday(date, overrides = null) {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  if (overrides && dateStr in overrides) {
    return overrides[dateStr] === 1;
  }
  const d = date instanceof Date ? date : new Date(date);
  return isWeekday(d) && !isHoliday(d);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Contar dias úteis entre duas datas
function countWorkdays(start, end, overrides = null) {
  if (!overrides) {
    overrides = getCustomOverrides();
  }
  let count = 0;
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    if (isWorkday(current, overrides)) count++;
    current = addDays(current, 1);
  }
  return count;
}

// Dias úteis restantes até o concurso
function getRemainingWorkdays(examDate) {
  const overrides = getCustomOverrides();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);

  if (today > exam) return 0;
  return countWorkdays(today, exam, overrides);
}

// Próximos N dias úteis
function getNextWorkdays(n, fromDate = new Date()) {
  const overrides = getCustomOverrides();
  const days = [];
  let current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);

  while (days.length < n) {
    if (isWorkday(current, overrides)) {
      days.push(new Date(current));
    }
    current = addDays(current, 1);
  }
  return days;
}

// Gerar calendário do mês com marcação de dias úteis
function getMonthCalendar(year, month, studiedDates = []) {
  const overrides = getCustomOverrides();
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const calendar = [];

  let current = new Date(firstDay);
  while (current <= lastDay) {
    const dateStr = current.toISOString().split('T')[0];
    calendar.push({
      date: dateStr,
      dayOfMonth: current.getDate(),
      dayOfWeek: current.getDay(),
      isWorkday: isWorkday(current, overrides),
      isHoliday: isHoliday(current),
      isStudied: studiedDates.includes(dateStr),
      isToday: dateStr === new Date().toISOString().split('T')[0],
    });
    current = addDays(current, 1);
  }
  return calendar;
}

// Sugestão de disciplina por dia (rotação baseada nos pesos)
function getDisciplineForDay(date, weights = { legislacao: 40, logica: 35, matematica: 25 }) {
  const disciplines = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);

  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  return disciplines[dayOfYear % disciplines.length];
}

module.exports = {
  countWorkdays,
  getRemainingWorkdays,
  getNextWorkdays,
  getMonthCalendar,
  getDisciplineForDay,
  isWorkday,
};
