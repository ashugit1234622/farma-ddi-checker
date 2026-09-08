'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DDIAnalysis } from '../lib/ai/schemas';

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

export default function AasthaChat({ isAnalyzing, drug1, drug2, report }: AasthaChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear chat if drugs change
  useEffect(() => {
    setMessages([]);
    if (!isOpen) return;
    
    // Auto-add welcome message when opened and empty
    const welcomeText = report 
      ? "Hi, I'm Aastha. I can help explain this report, including the interaction mechanism, ADME findings, toxicity, monitoring considerations, alternatives, and evidence."
      : "Hi, I'm Aastha. I can help you understand how Farma DDI Checker works and explain pharmacology concepts. Once you run an analysis, I can also explain the findings from your report.";
      
    setMessages([{ role: 'assistant', content: welcomeText }]);
  }, [drug1?.id, drug2?.id, report, isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Keep only last 6 messages for context
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

      if (!res.ok) {
        throw new Error('Failed to fetch response');
      }

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

  // Hide entirely if currently running the scanning cinematic
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

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button 
          className="aastha-trigger-btn"
          onClick={() => setIsOpen(true)}
          title="Ask Aastha"
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
          <div className="aastha-header">
            <div className="aastha-header-info">
              <div className="aastha-name">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                AASTHA
              </div>
              <div className="aastha-subtitle">Farma DDI Assistant</div>
            </div>
            <button className="aastha-close" onClick={() => setIsOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

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

          {/* Contextual Chips */}
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

          <div className="aastha-input-area">
            <input 
              className="aastha-input"
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend(input)}
              disabled={isLoading}
            />
            <button 
              className="aastha-send-btn"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
