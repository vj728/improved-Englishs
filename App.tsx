
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import { geminiService, playPcmAudio } from './services/geminiService';
import { PracticeMode, AppTheme } from './types';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [mode, setMode] = useState<PracticeMode>('standard');
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('ff-theme') as AppTheme) || 'light');
  
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [suggestedAnswer, setSuggestedAnswer] = useState<string>('');
  const [customQuestion, setCustomQuestion] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState<boolean>(false);

  const [convWho, setConvWho] = useState<string>('');
  const [convWhom, setConvWhom] = useState<string>('');
  const [convTopic, setConvTopic] = useState<string>('');
  const [convScript, setConvScript] = useState<string>('');

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ff-theme', theme);
  }, [theme]);

  const loadQuestion = useCallback(async (selectedMode: PracticeMode) => {
    if (selectedMode === 'conversation' || selectedMode === 'custom') return;
    setIsLoading(true);
    setError(null);
    setIsQuotaError(false);
    setSuggestedAnswer('');
    try {
      const question = await geminiService.generateQuestion(selectedMode);
      setCurrentQuestion(question);
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") setIsQuotaError(true);
      setError("Quota limit reached. Try waiting or switch keys.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setConvScript('');
    setCurrentQuestion('');
    setSuggestedAnswer('');
    if (mode === 'standard' || mode === 'hinglish') {
      loadQuestion(mode);
    }
  }, [mode, loadQuestion]);

  const handleShowAnswer = async () => {
    const questionToUse = mode === 'custom' ? customQuestion : currentQuestion;
    if (!questionToUse) return;
    
    setIsStreaming(true);
    setSuggestedAnswer('');
    setError(null);
    setIsQuotaError(false);
    try {
      const stream = geminiService.generateSuggestedAnswerStream(mode, questionToUse);
      for await (const chunk of stream) {
        setSuggestedAnswer(prev => prev + chunk);
      }
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") setIsQuotaError(true);
      setError("Quota exhausted. Switch API keys to continue immediately.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleGenerateConversation = async () => {
    if (!convWho || !convWhom || !convTopic) return;
    setIsStreaming(true);
    setConvScript('');
    setError(null);
    try {
      const stream = geminiService.generateConversationStream(convWho, convWhom, convTopic);
      for await (const chunk of stream) {
        setConvScript(prev => prev + chunk);
      }
    } catch (err) {
      setError("Generation failed. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSpeak = async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      const audioData = await geminiService.speakAnswer(text);
      if (audioData) await playPcmAudio(audioData, audioCtxRef.current);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSpeaking(false);
    }
  };

  const themes: {id: AppTheme, name: string, color: string}[] = [
    {id: 'light', name: 'Light', color: '#6366f1'},
    {id: 'dark', name: 'Dark', color: '#a78bfa'},
    {id: 'navy', name: 'Navy', color: '#2dd4bf'},
    {id: 'blue', name: 'Blue', color: '#0ea5e9'},
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:p-10 space-y-12 pb-32">
        {/* Navigation & Customization Section */}
        <section className="space-y-8">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40">Choose Theme</span>
            <div className="flex gap-2 p-1.5 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] card-shadow">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`theme-pill w-8 h-8 rounded-xl flex items-center justify-center transition-all ${theme === t.id ? 'ring-2 ring-[var(--accent)] ring-offset-4 scale-110' : 'opacity-40 hover:opacity-100'}`}
                  style={{
                    backgroundColor: t.color, 
                    '--tw-ring-offset-color': 'var(--bg-color)'
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>

          <div className="bg-[var(--card-bg)] p-2 rounded-3xl flex overflow-x-auto gap-1 border border-[var(--border)] card-shadow no-scrollbar">
            {['standard', 'hinglish', 'custom', 'conversation'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as PracticeMode)}
                className={`flex-1 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all btn-active whitespace-nowrap ${
                  mode === m 
                    ? 'shadow-lg text-white' 
                    : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)]'
                }`}
                style={{backgroundColor: mode === m ? 'var(--accent)' : 'transparent'}}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        {mode === 'conversation' ? (
          <div className="space-y-8">
            <div className="card-entry rounded-[3rem] p-10 space-y-8">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner" style={{backgroundColor: 'var(--accent-soft)', color: 'var(--accent)'}}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Dialogue Studio</h2>
                  <p className="text-xs font-medium opacity-50">Create expert-level scripts</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-50">Speaker A</label>
                    <input
                      className="w-full p-5 bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] outline-none font-bold text-[var(--text-main)] transition-all placeholder:opacity-30"
                      value={convWho} onChange={e => setConvWho(e.target.value)} placeholder="Interviewer"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-50">Speaker B</label>
                    <input
                      className="w-full p-5 bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] outline-none font-bold text-[var(--text-main)] transition-all placeholder:opacity-30"
                      value={convWhom} onChange={e => setConvWhom(e.target.value)} placeholder="Candidate"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-50">Topic of Discussion</label>
                  <input
                    className="w-full p-5 bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl focus:ring-2 focus:ring-[var(--accent)] outline-none font-bold text-[var(--text-main)] transition-all placeholder:opacity-30"
                    value={convTopic} onChange={e => setConvTopic(e.target.value)} placeholder="Discussing career goals..."
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateConversation}
                disabled={isStreaming || !convWho || !convWhom || !convTopic}
                className="w-full py-6 rounded-[2rem] font-black text-white text-lg transition-all btn-active disabled:opacity-30 shadow-2xl"
                style={{backgroundColor: 'var(--accent)'}}
              >
                {isStreaming ? 'AI is Writing...' : 'Generate Script'}
              </button>
            </div>

            {convScript && (
              <div className="card-entry rounded-[3rem] p-10 space-y-10">
                <div className="flex justify-between items-center pb-6 border-b border-[var(--border)]">
                  <span className="text-[11px] font-black uppercase tracking-widest opacity-50">Dialogue Output</span>
                  <button onClick={() => handleSpeak(convScript)} disabled={isSpeaking} className="p-4 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] btn-active disabled:opacity-50">
                    {isSpeaking ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
                  </button>
                </div>
                <div className="space-y-8">
                  {convScript.split('\n').filter(l => l.trim()).map((line, i) => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex === -1) return <p key={i} className="text-sm opacity-40 italic">{line}</p>;
                    return (
                      <div key={i} className="space-y-2 group">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-30 group-hover:opacity-100 transition-opacity" style={{color: 'var(--accent)'}}>{line.slice(0, colonIndex)}</span>
                        <p className="text-lg md:text-xl font-bold leading-relaxed">{line.slice(colonIndex + 1).trim()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <div className="card-entry rounded-[3.5rem] p-10 md:p-14 space-y-10">
              {isLoading ? (
                <div className="flex flex-col items-center py-20 gap-8">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-[6px] border-[var(--accent-soft)] rounded-full" />
                    <div className="absolute inset-0 border-[6px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Tuning AI Context</p>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: 'var(--accent)'}} />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Practice Prompt</span>
                  </div>
                  
                  {mode === 'custom' ? (
                    <textarea
                      className="w-full p-8 bg-[var(--bg-color)] border-2 border-transparent focus:border-[var(--accent-soft)] rounded-[2.5rem] outline-none font-bold text-2xl md:text-3xl min-h-[220px] transition-all placeholder:opacity-20"
                      placeholder="What is your biggest dream in life?"
                      value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)}
                    />
                  ) : (
                    <h2 className="text-3xl md:text-5xl font-black leading-[1.05] tracking-tight">{currentQuestion || "Let's speak!"}</h2>
                  )}
                  
                  <div className="flex flex-col gap-4 pt-4">
                    <button 
                      onClick={handleShowAnswer} 
                      disabled={isStreaming || (mode === 'custom' && !customQuestion) || (mode !== 'custom' && !currentQuestion)} 
                      className="py-6 rounded-[2rem] font-black text-white text-xl shadow-2xl btn-active disabled:opacity-30"
                      style={{backgroundColor: 'var(--accent)'}}
                    >
                      {isStreaming ? 'AI Thinking...' : 'Analyze & Answer'}
                    </button>
                    {(mode === 'standard' || mode === 'hinglish') && (
                      <button onClick={() => loadQuestion(mode)} className="py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all btn-active border border-[var(--border)] hover:bg-[var(--accent-soft)]" style={{color: 'var(--text-main)'}}>
                        Shuffle Question
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {suggestedAnswer && (
              <div className="card-entry rounded-[3.5rem] p-10 md:p-14 space-y-12">
                <div className="flex justify-between items-center pb-8 border-b border-[var(--border)]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)] text-white font-black text-sm">AI</div>
                    <span className="text-[11px] font-black uppercase tracking-widest opacity-50">Fluency Model</span>
                  </div>
                  <button onClick={() => handleSpeak(suggestedAnswer)} disabled={isSpeaking} className="p-4 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] btn-active">
                    {isSpeaking ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
                  </button>
                </div>
                <div className="relative">
                  <p className="text-xl md:text-3xl font-bold leading-[1.6] opacity-90">{suggestedAnswer}</p>
                  {isStreaming && <div className="inline-block w-2 h-8 ml-2 bg-[var(--accent)] animate-pulse rounded-full align-middle" />}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-8 rounded-[2.5rem] bg-red-500/5 border border-red-500/20 text-red-500 text-center animate-in zoom-in-95">
            <p className="font-black text-sm uppercase tracking-widest">{error}</p>
            {isQuotaError && (
              <button onClick={() => window.aistudio?.openSelectKey()} className="mt-6 px-8 py-4 bg-red-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl btn-active">
                Switch API Key
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="py-16 text-center mt-auto opacity-20 hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">FluentFlow AI Engine • 2025</p>
      </footer>
    </div>
  );
};

export default App;
