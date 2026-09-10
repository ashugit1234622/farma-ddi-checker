'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DDIAnalysis } from '../lib/ai/schemas';
import OrbitalAnimation, { VoiceState } from './OrbitalAnimation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AasthaChatProps {
  isAnalyzing: boolean;
  drug1: any | null;
  drug2: any | null;
  report: DDIAnalysis | null;
}

// ─── Language Configuration (easily expandable) ───────────────────────────────
interface LanguageOption {
  code: string;        // BCP-47 for SpeechRecognition
  voice: string;       // Edge TTS voice name
  label: string;       // Display label
  nativeLabel: string; // Native script label
}

const LANGUAGES: LanguageOption[] = [
  { code: 'hi-IN', voice: 'hi-IN-SwaraNeural',     label: 'Hindi',     nativeLabel: 'हिंदी' },
  { code: 'mr-IN', voice: 'mr-IN-AarohiNeural',    label: 'Marathi',   nativeLabel: 'मराठी' },
  { code: 'ta-IN', voice: 'ta-IN-PallaviNeural',   label: 'Tamil',     nativeLabel: 'தமிழ்' },
  { code: 'te-IN', voice: 'te-IN-ShrutiNeural',    label: 'Telugu',    nativeLabel: 'తెలుగు' },
  { code: 'bn-IN', voice: 'bn-IN-TanishaaNeural',  label: 'Bengali',   nativeLabel: 'বাংলা' },
  { code: 'gu-IN', voice: 'gu-IN-DhwaniNeural',    label: 'Gujarati',  nativeLabel: 'ગુજરાતી' },
  { code: 'kn-IN', voice: 'kn-IN-SapnaNeural',     label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml-IN', voice: 'ml-IN-SobhanaNeural',   label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'pa-IN', voice: 'pa-IN-OjasNeural',      label: 'Punjabi',   nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'en-IN', voice: 'en-IN-NeerjaNeural',    label: 'English',   nativeLabel: 'English' },
];

// ─── Voice State Machine ──────────────────────────────────────────────────────
type VoiceMode =
  | 'off'                    // voice mode not active
  | 'permission_required'    // waiting for mic permission
  | 'language_selection'     // choosing language (once per session)
  | 'listening'              // mic active, waiting for speech
  | 'processing'             // transcript sent to Aastha API
  | 'speaking'               // Edge TTS playing
  | 'error';                 // error state

// ─── Web Speech API Type Declarations ───────────────────────────────────────
// These are not always included in TypeScript's lib.dom.d.ts.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onnomatch: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getOrbitalState(mode: VoiceMode): VoiceState {
  if (mode === 'processing') return 'processing';
  if (mode === 'speaking') return 'speaking';
  if (mode === 'listening') return 'listening';
  return 'ready';
}

function getStatusLabel(mode: VoiceMode, errorMsg: string): string {
  switch (mode) {
    case 'permission_required': return 'Microphone access required';
    case 'language_selection': return 'Choose your language';
    case 'listening': return 'Listening...';
    case 'processing': return 'Thinking...';
    case 'speaking': return 'Aastha is speaking...';
    case 'error': return errorMsg || 'Something went wrong';
    default: return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AasthaChat({ isAnalyzing, drug1, drug2, report }: AasthaChatProps) {
  // ── Existing chat state (unchanged) ─────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off');
  const [voiceError, setVoiceError] = useState('');
  const [speakingAmplitude, setSpeakingAmplitude] = useState(0);

  // Session-persistent language selection (survive open/close, reset on page refresh)
  const sessionLangRef = useRef<LanguageOption | null>(null);
  const [selectedLang, setSelectedLang] = useState<LanguageOption | null>(null);

  // Refs for cleanup
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const animFrameRef = useRef<number>(0);
  const isSpeakingRef = useRef(false);

  // ── Scroll on new messages ───────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Welcome message on open ──────────────────────────────────────────────
  useEffect(() => {
    setMessages([]);
    if (!isOpen) return;
    const welcomeText = report
      ? "Hi, I'm Aastha. I can help explain this report, including the interaction mechanism, ADME findings, toxicity, monitoring considerations, alternatives, and evidence."
      : "Hi, I'm Aastha. I can help you understand how Farma DDI Checker works and explain pharmacology concepts. Once you run an analysis, I can also explain the findings from your report.";
    setMessages([{ role: 'assistant', content: welcomeText }]);
  }, [drug1?.id, drug2?.id, report, isOpen]);

  // ── Cleanup on unmount / close voice ────────────────────────────────────
  const cleanupVoice = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setSpeakingAmplitude(0);
  }, []);

  useEffect(() => {
    // Preload voices if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => cleanupVoice();
  }, [cleanupVoice]);

  // ─────────────────────────────────────────────────────────────────────────
  // EXISTING AASTHA TEXT SEND (unchanged logic)
  // ─────────────────────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const historyToSend = newMessages.slice(-6);
      const res = await fetch('/api/ai/aastha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: historyToSend,
          drugContext: drug1 && drug2 ? { drug1: drug1.name, drug2: drug2.name } : null,
          reportContext: report
        })
      });

      if (!res.ok) throw new Error('Failed to fetch response');
      const { data } = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I couldn't generate a response right now. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE: SEND MESSAGE (uses existing Aastha endpoint, same conversation)
  // ─────────────────────────────────────────────────────────────────────────
  const handleVoiceSend = useCallback(async (transcript: string, lang: LanguageOption) => {
    if (!transcript.trim()) {
      // Nothing heard — return to listening
      setVoiceMode('listening');
      startListening(lang);
      return;
    }

    // Add user transcript to shared conversation
    const userMsg: Message = { role: 'user', content: transcript.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setVoiceMode('processing');

    try {
      // Send to EXISTING Aastha API — identical to text chat
      // Append conciseness hint inline so backend prompt is never altered
      const voiceText = `${transcript.trim()} (Please keep your response to around 100 words.)`;
      const historyToSend = newMessages.slice(-6);

      const res = await fetch('/api/ai/aastha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: voiceText,
          conversationHistory: historyToSend,
          drugContext: drug1 && drug2 ? { drug1: drug1.name, drug2: drug2.name } : null,
          reportContext: report
        })
      });

      if (!res.ok) throw new Error('Aastha API failed');
      const { data } = await res.json();
      const answer: string = data.answer;

      // Add Aastha response to shared conversation
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);

      // Speak the answer via Edge TTS
      await speakText(answer, lang);

    } catch (err) {
      console.error('[Voice] Error:', err);
      setVoiceMode('error');
      setVoiceError("Aastha couldn't respond. Please try again.");
      setTimeout(() => {
        setVoiceMode('listening');
        startListening(lang);
      }, 2500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, drug1, drug2, report]);

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE: EDGE TTS PLAYBACK
  // ─────────────────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text: string, lang: LanguageOption) => {
    if (!('speechSynthesis' in window)) {
      setVoiceError('Voice playback unavailable in this browser. You can still read the response.');
      setTimeout(() => setVoiceError(''), 3000);
      return;
    }

    setVoiceMode('speaking');
    isSpeakingRef.current = true;

    // Simulate amplitude for orbital animation
    const simulateAmplitude = () => {
      if (!isSpeakingRef.current) {
        setSpeakingAmplitude(0);
        return;
      }
      setSpeakingAmplitude(0.15 + Math.random() * 0.4); // Pulse effect
      animFrameRef.current = requestAnimationFrame(() => {
        setTimeout(simulateAmplitude, 100);
      });
    };
    simulateAmplitude();

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Voice matching logic
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find(v => v.lang.replace('_', '-') === lang.code);
    if (!selectedVoice) {
      // Fallback to language family (e.g., 'hi' for 'hi-IN')
      const langFamily = lang.code.split('-')[0];
      selectedVoice = voices.find(v => v.lang.startsWith(langFamily));
    }
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      utterance.lang = lang.code; // Let browser try to match by lang property
    }

    return new Promise<void>((resolve) => {
      utterance.onend = () => {
        isSpeakingRef.current = false;
        cancelAnimationFrame(animFrameRef.current);
        setSpeakingAmplitude(0);
        
        // Return to listening mode if we are still active
        setVoiceMode(currentMode => {
          if (currentMode !== 'off' && currentMode !== 'error') {
             const currentLang = sessionLangRef.current;
             if (currentLang) {
                // Must start listening asynchronously after state update
                setTimeout(() => startListening(currentLang), 50);
                return 'listening';
             }
          }
          return currentMode;
        });
        resolve();
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.error('[TTS] SpeechSynthesis error:', e);
          setVoiceError('Voice playback interrupted.');
          setTimeout(() => setVoiceError(''), 3000);
        }
        isSpeakingRef.current = false;
        cancelAnimationFrame(animFrameRef.current);
        setSpeakingAmplitude(0);
        // Do not auto-restart listening on error to avoid loops
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE: SPEECH RECOGNITION
  // ─────────────────────────────────────────────────────────────────────────
  const startListening = useCallback((lang: LanguageOption) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceMode('error');
      setVoiceError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = lang.code;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setVoiceMode('listening');

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript || '';
      if (transcript.trim()) {
        setVoiceMode('processing');
        handleVoiceSend(transcript, lang);
      } else {
        // Empty result — listen again
        setVoiceMode('listening');
        startListening(lang);
      }
    };

    recognition.onnomatch = () => {
      setVoiceError("I couldn't understand that. Please try again.");
      setVoiceMode('error');
      setTimeout(() => {
        setVoiceError('');
        setVoiceMode('listening');
        startListening(lang);
      }, 2000);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') {
        // User just didn't speak — silently restart
        setVoiceMode('listening');
        startListening(lang);
        return;
      }
      if (e.error === 'aborted') return; // Manual cleanup
      setVoiceError(`Recognition error: ${e.error}. Please try again.`);
      setVoiceMode('error');
      setTimeout(() => {
        setVoiceError('');
        setVoiceMode('listening');
        startListening(lang);
      }, 2500);
    };

    recognition.onend = () => {
      // If still listening state, it ended without a result — restart
      if (voiceMode === 'listening' && !isSpeakingRef.current) {
        startListening(lang);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('[Voice] Recognition start failed:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleVoiceSend, voiceMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE: OPEN VOICE MODE (request mic permission first)
  // ─────────────────────────────────────────────────────────────────────────
  const openVoiceMode = useCallback(async () => {
    setVoiceMode('permission_required');
    setVoiceError('');

    try {
      // Explicitly request microphone permission (works on both mobile & desktop)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted — release the stream immediately (SpeechRecognition manages its own)
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      setVoiceMode('error');
      setVoiceError('Microphone access is required for voice conversations with Aastha. Please allow microphone access and try again.');
      return;
    }

    // Language already selected this session? Skip selection
    if (sessionLangRef.current) {
      setSelectedLang(sessionLangRef.current);
      setVoiceMode('listening');
      startListening(sessionLangRef.current);
    } else {
      setVoiceMode('language_selection');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  const handleLanguageSelect = useCallback((lang: LanguageOption) => {
    sessionLangRef.current = lang;
    setSelectedLang(lang);
    setVoiceMode('listening');
    startListening(lang);
  }, [startListening]);

  const closeVoiceMode = useCallback(() => {
    cleanupVoice();
    setVoiceMode('off');
    setVoiceError('');
  }, [cleanupVoice]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  if (isAnalyzing) return null;

  const preReportChips = [
    "What is a drug interaction?",
    "How does the analysis work?",
    "What is ADME?",
    "What does CYP mean?"
  ];
  const postReportChips = [
    "Why is this interaction significant?",
    "Explain the mechanism",
    "Why was this alternative suggested?",
    "Explain the ADME findings"
  ];
  const chips = report ? postReportChips : preReportChips;

  const isVoiceActive = voiceMode !== 'off';
  const orbitalState = getOrbitalState(voiceMode as VoiceMode);
  const statusLabel = getStatusLabel(voiceMode as VoiceMode, voiceError);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating Trigger Button (unchanged) */}
      {!isOpen && (
        <button
          className="aastha-trigger-btn"
          onClick={() => setIsOpen(true)}
          title="Ask Aastha"
          aria-label="Open Aastha AI assistant"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <path d="m9.5 9.5 5 5"></path>
            <path d="m14.5 9.5-5 5"></path>
          </svg>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="aastha-panel">
          {/* Header (unchanged) */}
          <div className="aastha-header">
            <div className="aastha-header-info">
              <div className="aastha-name">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                AASTHA
                {isVoiceActive && selectedLang && (
                  <span className="aastha-voice-lang-badge" aria-label={`Voice mode: ${selectedLang.label}`}>
                    🎙 {selectedLang.nativeLabel}
                  </span>
                )}
              </div>
              <div className="aastha-subtitle">Farma DDI Assistant</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {/* Change language button (inside voice mode) */}
              {isVoiceActive && voiceMode !== 'language_selection' && (
                <button
                  className="aastha-voice-change-lang"
                  onClick={() => {
                    cleanupVoice();
                    sessionLangRef.current = null;
                    setSelectedLang(null);
                    setVoiceMode('language_selection');
                  }}
                  title="Change language"
                  aria-label="Change voice language"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </button>
              )}
              <button
                className="aastha-close"
                onClick={() => {
                  closeVoiceMode();
                  setIsOpen(false);
                }}
                aria-label="Close Aastha"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* ── VOICE MODE UI ─────────────────────────────────── */}
          {isVoiceActive ? (
            <div className="aastha-voice-container">

              {/* Language Selection */}
              {voiceMode === 'language_selection' && (
                <div className="aastha-lang-select" role="dialog" aria-label="Choose voice language">
                  <div className="aastha-lang-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Choose your language
                  </div>
                  <p className="aastha-lang-subtitle">Select once for this session</p>
                  <div className="aastha-lang-grid" role="radiogroup" aria-label="Language options">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        className="aastha-lang-btn"
                        onClick={() => handleLanguageSelect(lang)}
                        aria-label={`Select ${lang.label}`}
                        role="radio"
                        aria-checked="false"
                      >
                        <span className="lang-native">{lang.nativeLabel}</span>
                        <span className="lang-en">{lang.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="aastha-voice-exit-btn"
                    onClick={closeVoiceMode}
                    aria-label="Close voice mode"
                  >
                    Back to text chat
                  </button>
                </div>
              )}

              {/* Permission Request */}
              {voiceMode === 'permission_required' && (
                <div className="aastha-voice-status-center">
                  <div className="aastha-voice-permission-icon">🎙</div>
                  <p className="aastha-voice-status-text">Requesting microphone access...</p>
                </div>
              )}

              {/* Orbital Animation + Status (active voice states) */}
              {(voiceMode === 'listening' || voiceMode === 'processing' || voiceMode === 'speaking') && (
                <div className="aastha-voice-orbital-area">
                  {/* Last assistant message shown above animation */}
                  {(() => {
                    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                    return lastAssistant ? (
                      <div className="aastha-voice-last-response" aria-live="polite" aria-atomic="true">
                        {lastAssistant.content}
                      </div>
                    ) : null;
                  })()}

                  <div className="aastha-orbital-wrap" aria-hidden="true">
                    <OrbitalAnimation state={orbitalState} amplitude={speakingAmplitude} />
                  </div>

                  <div className="aastha-voice-state-label" role="status" aria-live="polite">
                    {statusLabel}
                  </div>

                  {voiceError && (
                    <div className="aastha-voice-error-inline" role="alert">
                      {voiceError}
                    </div>
                  )}

                  <button
                    className="aastha-voice-exit-btn"
                    onClick={closeVoiceMode}
                    aria-label="Close voice mode and return to text chat"
                  >
                    ← Back to text
                  </button>
                </div>
              )}

              {/* Error State */}
              {voiceMode === 'error' && (
                <div className="aastha-voice-status-center">
                  <div className="aastha-voice-error-icon">⚠</div>
                  <p className="aastha-voice-status-text" role="alert">{voiceError}</p>
                  <button
                    className="aastha-voice-retry-btn"
                    onClick={() => openVoiceMode()}
                    aria-label="Try again"
                  >
                    Try Again
                  </button>
                  <button
                    className="aastha-voice-exit-btn"
                    onClick={closeVoiceMode}
                    aria-label="Close voice mode"
                  >
                    Back to text chat
                  </button>
                </div>
              )}
            </div>

          ) : (
            /* ── NORMAL TEXT CHAT UI (100% unchanged) ───────── */
            <>
              <div className="aastha-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`aastha-message ${m.role}`}>
                    {m.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="aastha-thinking">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotating-icon">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                    <span>Aastha is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Contextual Chips (unchanged) */}
              {messages.length <= 2 && !isLoading && (
                <div className="aastha-chips">
                  {chips.map(chip => (
                    <button
                      key={chip}
                      className="aastha-chip"
                      onClick={() => handleSend(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area — Voice button added beside Send */}
              <div className="aastha-input-area">
                <input
                  className="aastha-input"
                  type="text"
                  placeholder="Ask a question..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                  disabled={isLoading}
                  aria-label="Message Aastha"
                />
                {/* Existing Send button (unchanged) */}
                <button
                  className="aastha-send-btn"
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
                {/* NEW: Voice button */}
                <button
                  className="aastha-voice-btn"
                  onClick={openVoiceMode}
                  disabled={isLoading}
                  title="Talk to Aastha"
                  aria-label="Talk to Aastha using voice"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
