
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-4 px-6 flex justify-between items-center glass sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg" style={{backgroundColor: 'var(--accent)'}}>
          F
        </div>
        <h1 className="text-xl font-black tracking-tight" style={{color: 'var(--text-main)'}}>
          FluentFlow
        </h1>
      </div>
      <div className="hidden md:block text-[11px] font-bold uppercase tracking-[0.2em]" style={{color: 'var(--text-muted)'}}>
        Professional English Engine
      </div>
    </header>
  );
};

export default Header;
