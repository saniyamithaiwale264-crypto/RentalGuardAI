import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Info,
  Loader2,
  MessageSquareText,
  Quote,
  RotateCcw,
  Send,
  Square,
  User,
  Volume2,
} from 'lucide-react';
import type { AgreementAnalysis, ChatMessage } from '../types/rental.ts';
import { sendAgreementChatMessage } from '../services/api.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useReadAloud } from '../context/ReadAloudContext.tsx';

interface ChatAssistantViewProps {
  analyses: AgreementAnalysis[];
  initialAnalysisId?: string;
  prefilledQuestion?: { nonce: number; analysisId: string; text: string } | null;
}

const STARTER_QUESTIONS = [
  'How much money would I owe if I terminate the lease early?',
  'When is rent considered late and what are the penalties?',
  'How much notice must I give before moving out?',
  'Who is responsible for appliance and HVAC repairs?',
  'Is any portion of my security deposit non-refundable?',
];

export function ChatAssistantView({
  analyses,
  initialAnalysisId,
  prefilledQuestion,
}: ChatAssistantViewProps) {
  const { languageName, displayLanguage, t } = useLanguage();
  const { status: audioStatus, activeItemId, toggleSpeak } = useReadAloud();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(
    initialAnalysisId || analyses[0]?.id || ''
  );
  const [messagesByAgreement, setMessagesByAgreement] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const lastHandledNonceRef = useRef<number>(0);

  useEffect(() => {
    if (initialAnalysisId) {
      setSelectedAnalysisId(initialAnalysisId);
    } else if (!selectedAnalysisId && analyses.length > 0) {
      setSelectedAnalysisId(analyses[0].id);
    }
  }, [initialAnalysisId, analyses, selectedAnalysisId]);

  const activeAnalysis =
    analyses.find((a) => a.id === selectedAnalysisId) || analyses[0];
  const messages = activeAnalysis ? messagesByAgreement[activeAnalysis.id] || [] : [];

  useEffect(() => {
    if (
      prefilledQuestion &&
      prefilledQuestion.nonce !== lastHandledNonceRef.current &&
      prefilledQuestion.text.trim()
    ) {
      lastHandledNonceRef.current = prefilledQuestion.nonce;
      setSelectedAnalysisId(prefilledQuestion.analysisId);
      setInput(prefilledQuestion.text);
    }
  }, [prefilledQuestion]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  async function askQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || !activeAnalysis || sending) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const existing = messagesByAgreement[activeAnalysis.id] || [];
    const nextWithUser = [...existing, userMsg];
    setMessagesByAgreement((prev) => ({
      ...prev,
      [activeAnalysis.id]: nextWithUser,
    }));
    setInput('');
    setSending(true);

    try {
      const reply = await sendAgreementChatMessage({
        analysisId: activeAnalysis.id,
        message: trimmed,
        history: existing.map((m) => ({ role: m.role, content: m.content })),
        language: languageName,
      });

      const assistantMsg: ChatMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        content: reply.answer,
        supportingClauses: reply.supportingClauses,
        disclaimerNote: reply.disclaimerNote,
        timestamp: new Date().toISOString(),
      };

      setMessagesByAgreement((prev) => ({
        ...prev,
        [activeAnalysis.id]: [...(prev[activeAnalysis.id] || nextWithUser), assistantMsg],
      }));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to get a response from the AI assistant.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void askQuestion(input);
  }

  if (!activeAnalysis) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-10 text-center shadow-xs space-y-2">
        <MessageSquareText className="h-8 w-8 text-indigo-600 mx-auto" aria-hidden="true" />
        <h1 className="font-display text-lg font-semibold text-slate-900">
          No Analyzed Agreement Selected
        </h1>
        <p className="text-sm text-slate-600">
          Upload and analyze a rental agreement first, or load the Sample Demo Lease from the Dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {t('chatHeading')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('chatSubtitle')} ({displayLanguage})
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5 w-full sm:w-auto">
          <div className="flex-1 sm:w-80">
            <label
              htmlFor="chat-agreement-select"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Active Agreement Context
            </label>
            <select
              id="chat-agreement-select"
              value={activeAnalysis.id}
              onChange={(e) => {
                setSelectedAnalysisId(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.isSampleResult ? '[Sample] ' : ''}
                  {a.title} ({a.rulebookVersionLabel})
                </option>
              ))}
            </select>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setMessagesByAgreement((prev) => ({
                  ...prev,
                  [activeAnalysis.id]: [],
                }))
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('clearBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Informational Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/75 px-4 py-3 text-xs text-slate-700">
        <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <span className="font-semibold text-slate-900">Document-Grounded Q&amp;A (Not Legal Advice):</span>{' '}
          Responses are strictly based on{' '}
          <span className="text-indigo-700 font-semibold">{activeAnalysis.fileName}</span>.
          {activeAnalysis.isSampleResult &&
            ' You are currently chatting with the Sample Demo Lease.'}
        </p>
      </div>

      {/* Chat Container */}
      <section className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-xs min-h-[520px] max-h-[680px]">
        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <div className="py-6 space-y-5">
              <div className="flex items-start gap-3 max-w-2xl">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-indigo-700">
                    RentalGuard AI Assistant
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    I have the full text of <span className="text-slate-900 font-semibold">{activeAnalysis.title}</span> ready. Ask any question about rent, deposits, lock-in penalties, repairs, notice periods, or guest rules—I will show the exact clause supporting every answer.
                  </p>
                </div>
              </div>

              <div className="pl-11 space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  Try asking one of these questions:
                </div>
                <div className="flex flex-wrap gap-2">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void askQuestion(q)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}

                <div
                  className={`max-w-3xl space-y-3 rounded-xl px-4 py-3.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-50 border border-indigo-200 text-slate-900'
                      : 'bg-slate-50 border border-slate-200/90 text-slate-800'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.supportingClauses && msg.supportingClauses.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                        <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Supporting Clause References</span>
                      </div>
                      {msg.supportingClauses.map((sc, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-200 bg-white p-3 space-y-1"
                        >
                          <div className="text-xs font-semibold text-slate-800">
                            {sc.clauseTitle}
                          </div>
                          <blockquote className="font-mono text-xs text-slate-600 leading-relaxed">
                            “{sc.exactQuote}”
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.disclaimerNote && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-slate-200/80 pt-2">
                      <span>{msg.disclaimerNote}</span>
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() =>
                            void toggleSpeak({
                              id: `chat-${msg.id}`,
                              title: `${t('chatHeading')}`,
                              text: msg.content,
                              languageName,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            activeItemId === `chat-${msg.id}` && audioStatus !== 'idle'
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {activeItemId === `chat-${msg.id}` && audioStatus !== 'idle' ? (
                            <Square className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Volume2 className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                          )}
                          <span>
                            {activeItemId === `chat-${msg.id}` && audioStatus !== 'idle'
                              ? t('stopReading')
                              : t('readAloud')}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {!msg.disclaimerNote && msg.role === 'assistant' && (
                    <div className="flex justify-end border-t border-slate-200/80 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          void toggleSpeak({
                            id: `chat-${msg.id}`,
                            title: `${t('chatHeading')}`,
                            text: msg.content,
                            languageName,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                          activeItemId === `chat-${msg.id}` && audioStatus !== 'idle'
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {activeItemId === `chat-${msg.id}` && audioStatus !== 'idle' ? (
                          <Square className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Volume2 className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                        )}
                        <span>
                          {activeItemId === `chat-${msg.id}` && audioStatus !== 'idle'
                            ? t('stopReading')
                            : t('readAloud')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
                <span>Reading agreement clauses...</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200/80 p-4 flex items-center gap-3 bg-slate-50/70 rounded-b-xl"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chatPlaceholder')}
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('askAi')}</span>
          </button>
        </form>
      </section>
    </div>
  );
}
