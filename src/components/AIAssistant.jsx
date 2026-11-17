import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm NovaCare's health assistant. Tell me what symptoms or concerns you're experiencing and I'll help you find the right specialist.",
};

function randomSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(randomSessionId);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { doctors } = useAppContext();

  const recommendedDoctor = recommendation
    ? doctors.find((d) => d.id === recommendation.doctorId)
    : null;
  const isRecommendedAvailable = recommendedDoctor?.isAvailable !== false;

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError("");

    const apiMessages = updatedMessages.filter((m) => m !== WELCOME);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }

      const data = await res.json();
      const cleanMessage = data.message
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .trim();
      setMessages((prev) => [...prev, { role: "assistant", content: cleanMessage }]);

      if (data.recommendation) {
        setRecommendation(data.recommendation);
      }
    } catch (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleBookNow() {
    navigate(`/doctors/${recommendation.doctorId}`, {
      state: {
        aiPrefill: {
          consultMode: recommendation.consultMode,
          // the booking form has Routine, Priority and Urgent only, so an emergency becomes an urgent follow-up request
          priority: recommendation.priority === "Emergency" ? "Urgent" : recommendation.priority,
          reason: recommendation.reasonForVisit,
          symptoms: recommendation.suggestedSymptoms,
        },
      },
    });
    setIsOpen(false);
  }

  const recBg =
    recommendation?.priority === "Emergency"
      ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
      : recommendation?.priority === "Urgent"
        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
        : "bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800";

  return (
    <>
      <button
        aria-label="Open health assistant"
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all duration-200 font-medium text-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Health Assistant
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] w-[380px] max-w-[calc(100vw-2rem)] bg-surface dark:bg-slate-900 rounded-2xl shadow-elevated border border-custom dark:border-slate-700/60 flex flex-col overflow-hidden animate-[slideUp_0.2s_ease-out]" role="dialog" aria-label="NovaCare Health Assistant">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 bg-primary-600 text-white">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">NovaCare Health Assistant</p>
              <p className="text-xs text-white/70">Online &middot; AI triage with safety rules</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[340px] bg-surface-alt dark:bg-slate-950">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0 text-xs">
                    &#9877;
                  </div>
                )}
                <div className={`max-w-[80%]`}>
                  <span className="text-[10px] text-ink-muted block mb-0.5">{msg.role === "user" ? "You" : "NovaCare AI"}</span>
                  <div className={`text-sm px-3 py-2 rounded-2xl ${msg.role === "user" ? "bg-primary-600 text-white rounded-br-md" : "bg-surface dark:bg-slate-800 text-ink rounded-bl-md border border-custom dark:border-slate-700/60"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0 text-xs">&#9877;</div>
                <div className="bg-surface dark:bg-slate-800 text-ink rounded-2xl rounded-bl-md px-4 py-3 border border-custom dark:border-slate-700/60">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          </div>

          {/* Recommendation */}
          {recommendation && (
            <div className={`p-4 border-t ${recBg}`}>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
                {recommendation.tentative ? "Likely specialist (may change as you answer)" : "Recommended Specialist"}
              </p>
              <p className="text-sm font-bold text-ink">{recommendation.doctorName}</p>
              <p className="text-xs text-ink-soft">{recommendation.specialty}</p>
              <div className="flex gap-1.5 mt-2 mb-3">
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/60 dark:bg-white/10 text-ink-soft">{recommendation.consultMode}</span>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full text-white ${recommendation.priority === "Emergency" ? "bg-red-600" : recommendation.priority === "Urgent" ? "bg-amber-600" : "bg-primary-600"}`}>
                  {recommendation.priority}
                </span>
                {!isRecommendedAvailable && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    Unavailable now
                  </span>
                )}
              </div>
              {!isRecommendedAvailable && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mb-2">
                  Note: This doctor might not be available right now. Contact the care desk or browse other specialists.
                </p>
              )}
              {recommendation.priority === "Emergency" && (
                <p className="text-[11px] font-semibold text-red-700 dark:text-red-300 mb-2">
                  If this is happening now, call 108 or 112 first. Booking is only for a follow-up.
                </p>
              )}
              <button onClick={handleBookNow} className="w-full py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                {recommendation.priority === "Emergency" ? "Book a follow-up" : "Book this doctor"} &rarr;
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-custom dark:border-slate-700/60 flex gap-2">
            <textarea
              ref={inputRef}
              disabled={isLoading}
              placeholder="Describe your symptoms..."
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-custom dark:border-slate-600 bg-surface-alt dark:bg-slate-800 text-ink placeholder:text-ink-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            <button
              disabled={isLoading || !input.trim()}
              onClick={sendMessage}
              className="self-end w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
