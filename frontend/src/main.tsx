import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './app/globals.css';
import Dashboard from './app/page';
import StudyPage from './app/study/page';
import CalendarPage from './app/calendar/page';
import UploadPage from './app/upload/page';
import StatsPage from './app/stats/page';
import SettingsPage from './app/settings/page';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
