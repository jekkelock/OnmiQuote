import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
