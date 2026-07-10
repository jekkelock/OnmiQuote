import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
