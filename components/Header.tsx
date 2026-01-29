
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-4 px-6 md:px-10 flex justify-between items-center glass sticky top-0 z-50 transition-all duration-300">
      <div className="flex items-center gap-3 group cursor-pointer">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))' }}>
          F
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight leading-none" style={{ color: 'var(--text-main)' }}>
            FluentFlow
          </h1>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 leading-none mt-1">AI Partner</span>
        </div>
      </div>
      <div className="hidden md:block">
        <div className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-color)]/50 backdrop-blur-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-muted)] to-[var(--text-main)]">
            Professional English Engine
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
