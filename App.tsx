
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

  const themes: { id: AppTheme, name: string, color: string }[] = [
    { id: 'light', name: 'Light', color: '#4f46e5' },
    { id: 'dark', name: 'Dark', color: '#818cf8' },
    { id: 'navy', name: 'Navy', color: '#2dd4bf' },
    { id: 'blue', name: 'Blue', color: '#0284c7' },
  ];

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-8 pb-32">
        {/* Controls Section */}
        <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border)] shadow-sm gap-4">
            <div className="flex overflow-x-auto gap-2 p-1 no-scrollbar w-full sm:w-auto">
              {['standard', 'hinglish', 'custom', 'conversation'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m as PracticeMode)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${mode === m
                      ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30'
                      : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-[var(--border)] border-opacity-50">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  className={`w-6 h-6 rounded-full transition-all duration-300 ${theme === t.id ? 'scale-125 ring-2 ring-offset-2 ring-[var(--accent)]' : 'opacity-50 hover:opacity-100 hover:scale-110'}`}
                  style={{
                    backgroundColor: t.color,
                    '--tw-ring-offset-color': 'var(--card-bg)'
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        </section>

        {mode === 'conversation' ? (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="card-entry rounded-[2.5rem] p-8 md:p-10 space-y-8">
              <div className="flex items-center gap-5 border-b border-[var(--border)] pb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner bg-[var(--accent-soft)] text-[var(--accent)]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Dialogue Studio</h2>
                  <p className="text-sm font-medium opacity-60">Design your perfect conversation scenario</p>
                </div>
              </div>

              <div className="grid gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3 input-focus-ring rounded-2xl">
                    <label className="text-[11px] font-bold uppercase tracking-widest px-1 opacity-50">Person A</label>
                    <input
                      className="w-full p-4 bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl outline-none font-semibold text-[var(--text-main)] transition-all placeholder:opacity-40"
                      value={convWho} onChange={e => setConvWho(e.target.value)} placeholder="e.g., Doctor"
                    />
                  </div>
                  <div className="space-y-3 input-focus-ring rounded-2xl">
                    <label className="text-[11px] font-bold uppercase tracking-widest px-1 opacity-50">Person B</label>
                    <input
                      className="w-full p-4 bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl outline-none font-semibold text-[var(--text-main)] transition-all placeholder:opacity-40"
                      value={convWhom} onChange={e => setConvWhom(e.target.value)} placeholder="e.g., Patient"
                    />
                  </div>
                </div>
                <div className="space-y-3 input-focus-ring rounded-2xl">
                  <label className="text-[11px] font-bold uppercase tracking-widest px-1 opacity-50">Discussion Topic</label>
                  <input
                    className="w-full p-4 bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl outline-none font-semibold text-[var(--text-main)] transition-all placeholder:opacity-40"
                    value={convTopic} onChange={e => setConvTopic(e.target.value)} placeholder="e.g., Discussing symptoms and treatment..."
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateConversation}
                disabled={isStreaming || !convWho || !convWhom || !convTopic}
                className="w-full py-5 rounded-[1.5rem] font-bold text-white text-lg transition-all btn-active disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] hover:brightness-110"
              >
                {isStreaming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Generating Script...
                  </span>
                ) : 'Generate Conversation'}
              </button>
            </div>

            {convScript && (
              <div className="card-entry rounded-[2.5rem] p-8 md:p-10 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex justify-between items-center pb-6 border-b border-[var(--border)]">
                  <span className="text-[11px] font-bold uppercase tracking-widest opacity-50">Script Output</span>
                  <button
                    onClick={() => handleSpeak(convScript)}
                    disabled={isSpeaking}
                    className="p-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors btn-active disabled:opacity-50"
                    title="Read Aloud"
                  >
                    {isSpeaking ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>}
                  </button>
                </div>
                <div className="space-y-6">
                  {convScript.split('\n').filter(l => l.trim()).map((line, i) => {
                    const colonIndex = line.indexOf(':');
                    const isSpeaker = colonIndex !== -1;
                    return (
                      <div key={i} className={`p-4 rounded-2xl ${isSpeaker ? 'bg-[var(--bg-color)]' : 'italic opacity-60'}`}>
                        {isSpeaker ? (
                          <>
                            <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-[var(--accent)]">
                              {line.slice(0, colonIndex)}
                            </div>
                            <p className="text-lg text-[var(--text-main)] leading-relaxed">
                              {line.slice(colonIndex + 1).trim()}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm">{line}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="card-entry rounded-[2.5rem] p-8 md:p-12 min-h-[400px] flex flex-col justify-center text-center relative">
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-[6px] border-[var(--accent-soft)] rounded-full" />
                    <div className="absolute inset-0 border-[6px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-40 animate-pulse">Crafting Question...</p>
                </div>
              ) : (
                <div className="space-y-8 mx-auto w-full max-w-2xl">
                  {mode === 'custom' ? (
                    <div className="input-focus-ring rounded-[2rem]">
                      <textarea
                        className="w-full p-6 bg-[var(--bg-color)] border-2 border-transparent rounded-[2rem] outline-none font-bold text-2xl md:text-3xl min-h-[200px] text-center resize-none placeholder:text-[var(--text-muted)] placeholder:opacity-20 transition-all"
                        placeholder="What's on your mind?"
                        value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-color)] border border-[var(--border)]">
                        <div className="w-2 h-2 rounded-full animate-pulse bg-[var(--accent)]" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Practice Topic</span>
                      </div>
                      <h2 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-balance">
                        {currentQuestion || "Ready to start?"}
                      </h2>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button
                      onClick={handleShowAnswer}
                      disabled={isStreaming || (mode === 'custom' && !customQuestion) || (mode !== 'custom' && !currentQuestion)}
                      className="w-full sm:w-auto px-8 py-4 rounded-[1.5rem] font-bold text-white text-lg shadow-xl shadow-[var(--accent)]/20 btn-active disabled:opacity-50 disabled:grayscale transition-all bg-gradient-to-br from-[var(--accent)] to-[var(--accent)] hover:brightness-110"
                    >
                      {isStreaming ? 'Thinking...' : 'Get Feedback'}
                    </button>
                    {(mode === 'standard' || mode === 'hinglish') && (
                      <button
                        onClick={() => loadQuestion(mode)}
                        className="w-full sm:w-auto px-8 py-4 rounded-[1.5rem] font-bold text-sm uppercase tracking-widest transition-all btn-active border border-[var(--border)] hover:bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      >
                        New Question
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {suggestedAnswer && (
              <div className="card-entry rounded-[2.5rem] p-8 md:p-12 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex justify-between items-center pb-6 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)] text-white font-bold text-xs shadow-md">AI</div>
                    <span className="text-[11px] font-bold uppercase tracking-widest opacity-50">Model Suggestion</span>
                  </div>
                  <button
                    onClick={() => handleSpeak(suggestedAnswer)}
                    disabled={isSpeaking}
                    className="p-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors btn-active"
                  >
                    {isSpeaking ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>}
                  </button>
                </div>
                <div className="relative">
                  <p className="text-xl md:text-2xl font-medium leading-relaxed opacity-90 text-[var(--text-main)]">{suggestedAnswer}</p>
                  {isStreaming && <span className="inline-block w-2.5 h-5 ml-2 bg-[var(--accent)] animate-pulse rounded-full align-middle" />}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-md p-6 rounded-[2rem] bg-red-500/10 border border-red-500/20 text-red-600 text-center animate-in zoom-in-95 backdrop-blur-sm">
            <p className="font-bold text-xs uppercase tracking-widest mb-2">Error Encountered</p>
            <p className="font-medium text-sm">{error}</p>
            {isQuotaError && (
              <button
                onClick={() => window.aistudio?.openSelectKey()}
                className="mt-4 px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg btn-active hover:bg-red-700 transition-colors"
              >
                Change API Key
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center mt-auto opacity-30 hover:opacity-100 transition-opacity duration-500">
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">FluentFlow Engine • 2026</p>
      </footer>
    </div>
  );
};

export default App;
