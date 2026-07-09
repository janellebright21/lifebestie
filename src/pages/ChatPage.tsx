import { useState, useRef, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import { Send, Brain, Check, X, RefreshCw } from 'lucide-react';
import { Task, Event, GroceryItem, UserMemory, Preferences, Goal, WeeklyGroceryList, GroceryCategory, LifeBestieMemory, MemoryCategory, MEMORY_CATEGORY_META } from '../lib/supabase';
import BestieAvatar from '../components/besties/BestieAvatar';

const CHAT_MESSAGES_KEY = 'lifebestie_chat_messages';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface SerializedMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO string
}

interface MemorySuggestion {
  category: MemoryCategory;
  title: string;
  value: string;
}

interface ChatPageProps {
  tasks: Task[];
  events: Event[];
  groceryItems: GroceryItem[];
  memory: UserMemory | null;
  goals?: Goal[];
  weeklyList?: WeeklyGroceryList | null;
  onAddTask: (title: string) => Promise<void>;
  onAddEvent?: (title: string, date: string, time: string) => Promise<void>;
  onAddGrocery: (name: string, category: GroceryCategory) => Promise<void>;
  onAddWeeklyItem?: (name: string, category: GroceryCategory, source: import('../lib/supabase').WeeklyGrocerySource) => Promise<void>;
  onUpdateMemory: (prefs: Preferences) => Promise<void>;
  getProactiveSuggestions?: () => string[];
  preferredName?: string;
  avatarTheme?: import('../lib/supabase').AvatarThemeId;
  character?: import('../lib/supabase').CharacterId;
  savedMemories?: LifeBestieMemory[];
  onSaveMemory?: (category: MemoryCategory, title: string, value: string) => Promise<LifeBestieMemory | null>;
  memoryEnabled?: boolean;
  getRelevantMemories?: (conversationText: string) => LifeBestieMemory[];
}

const SUGGESTED_PROMPTS = [
  "What's next today?",
  'Plan my day',
  'Add groceries',
  'Help me stay organized',
];

const VALID_CATEGORIES: MemoryCategory[] = [
  'Preference', 'Goal', 'Routine', 'Meal', 'Household',
  'WorkSchedule', 'EncouragementStyle', 'Wellness',
  'ImportantDate', 'Challenge', 'Favorite', 'Budget', 'Other',
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Message sessionStorage persistence ────────────────────────────────────────

function saveMessagesToSession(messages: Message[]): void {
  try {
    const serialized: SerializedMessage[] = messages.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    }));
    sessionStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(serialized));
  } catch {
    // sessionStorage write failed — fine, messages just won't survive a remount
  }
}

function loadMessagesFromSession(): Message[] | null {
  try {
    const raw = sessionStorage.getItem(CHAT_MESSAGES_KEY);
    if (!raw) return null;
    const parsed: SerializedMessage[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return null;
  }
}

// ── Edge Function call ─────────────────────────────────────────────────────────

async function callChatFunction(
  messages: Message[],
  tasks: Task[],
  events: Event[],
  groceryItems: GroceryItem[],
  memory: UserMemory | null,
  proactiveSuggestions: string[],
  relevantMemories: LifeBestieMemory[],
): Promise<{ text: string; memory_suggestion?: MemorySuggestion }> {
  const today = new Date().toISOString().split('T')[0];
  const pending = tasks.filter((t) => !t.completed);
  const todayEvents = events.filter((e) => e.event_date === today);
  const uncheckedGrocery = groceryItems.filter((g) => !g.checked);

  const context: Record<string, unknown> = {
    pendingTaskCount: pending.length,
    todayEventCount: todayEvents.length,
    groceryItemCount: uncheckedGrocery.length,
    pendingTaskTitles: pending.slice(0, 5).map((t) => t.title),
    todayEventTitles: todayEvents
      .slice(0, 5)
      .map((e) => `${e.event_time ? e.event_time + ' ' : ''}${e.title}`),
    savedMemories: relevantMemories.map((m) => ({ category: m.category, title: m.title })),
  };

  if (memory) {
    context.routines = memory.routines;
    context.preferences = memory.preferences;
    const recentHistory = memory.history.slice(-7);
    context.recentActions = recentHistory.flatMap((h) => h.actions).slice(-20);
    context.commonGroceries = [...memory.common_groceries]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map((g) => `${g.name} (${g.category}, x${g.frequency})`);
    context.proactiveSuggestions = proactiveSuggestions;
  }

  const apiMessages = messages
    .filter((m) => m.id !== 'init')
    .map((m) => ({ role: m.role, content: m.text }));

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages: apiMessages, context }),
    });
  } catch (networkErr) {
    console.error('[Chat] Network error:', networkErr);
    throw new Error('network');
  }

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch { /* ignore */ }
    console.error(`[Chat] Edge function error ${response.status}:`, detail);
    throw new Error(`http:${response.status}`);
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (jsonErr) {
    console.error('[Chat] Invalid JSON from edge function:', jsonErr);
    throw new Error('invalid_json');
  }

  const text = typeof data.text === 'string' && data.text.trim()
    ? data.text
    : "I'm here for you 💛 Could you say that again?";

  let memory_suggestion: MemorySuggestion | undefined;
  try {
    const ms = data.memory_suggestion;
    if (
      ms &&
      typeof ms === 'object' &&
      typeof (ms as Record<string, unknown>).category === 'string' &&
      typeof (ms as Record<string, unknown>).title === 'string'
    ) {
      memory_suggestion = {
        category: (ms as Record<string, unknown>).category as MemoryCategory,
        title:    (ms as Record<string, unknown>).title as string,
        value:    typeof (ms as Record<string, unknown>).value === 'string'
          ? (ms as Record<string, unknown>).value as string
          : '',
      };
    }
  } catch {
    // memory_suggestion parse failed — continue without it
  }

  return { text, memory_suggestion };
}

// ── Memory confirmation banner ─────────────────────────────────────────────────

function MemoryConfirmBanner({
  suggestion,
  onConfirm,
  onDismiss,
  saving,
}: {
  suggestion: MemorySuggestion;
  onConfirm: () => void;
  onDismiss: () => void;
  saving: boolean;
}) {
  const meta = MEMORY_CATEGORY_META[suggestion.category] ?? MEMORY_CATEGORY_META['Other'];
  return (
    <div
      className="mx-4 mb-3 rounded-2xl px-4 py-3 border flex items-start gap-3"
      style={{ backgroundColor: meta.bg, borderColor: `${meta.color}44` }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base"
        style={{ backgroundColor: `${meta.color}22` }}
      >
        {meta.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: meta.color }}>
          <Brain size={9} className="inline mr-1 -mt-px" />
          Would you like me to remember that?
        </p>
        <p className="text-sm font-semibold text-gray-800 leading-snug">{suggestion.title}</p>
        {suggestion.value && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{suggestion.value}</p>
        )}
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50 active:scale-95 transition-all"
            style={{ backgroundColor: meta.color }}
          >
            <Check size={11} />
            {saving ? 'Saving…' : 'Yes, remember it'}
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/70 text-gray-500 border border-gray-200 active:scale-95 transition-all"
          >
            <X size={11} />
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Error boundary ─────────────────────────────────────────────────────────────
// Catches any unexpected React render error inside ChatPage and shows a friendly
// in-chat recovery UI instead of crashing the whole application.

interface ErrorBoundaryState { hasError: boolean }

class ChatErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    console.error('[Chat] Uncaught render error:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-[100dvh] max-w-md mx-auto items-center justify-center px-8 gap-4">
          <p className="text-4xl">💛</p>
          <p className="text-base font-semibold text-gray-700 text-center">
            Emma had trouble responding. Your chat is still here.
          </p>
          <p className="text-sm text-gray-400 text-center">Please try again.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="flex items-center gap-2 mt-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold active:scale-95 transition-all theme-bg-primary"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main chat component ────────────────────────────────────────────────────────

function ChatPageInner({
  tasks,
  events,
  groceryItems,
  memory,
  onAddTask,
  onAddGrocery,
  onUpdateMemory,
  getProactiveSuggestions,
  preferredName,
  avatarTheme: _avatarTheme,
  character,
  savedMemories = [],
  onSaveMemory,
  memoryEnabled = true,
  getRelevantMemories,
}: ChatPageProps) {
  const buildInitMessage = (): Message => ({
    id: 'init',
    role: 'assistant',
    text: preferredName
      ? `Hey ${preferredName} 💛 I'm here to help you stay on top of things today. What do you need?`
      : "Hey 💛 I'm here to help you stay on track today. What do you need?",
    timestamp: new Date(),
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadMessagesFromSession();
    return saved ?? [buildInitMessage()];
  });
  const [input, setInput]                         = useState('');
  const [isTyping, setIsTyping]                   = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<MemorySuggestion | null>(null);
  const [savingMemory, setSavingMemory]           = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    saveMessagesToSession(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, pendingSuggestion]);

  async function sendMessage(text: string) {
    if (!text.trim() || isTyping) return;

    setPendingSuggestion(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const recentText = updatedMessages.slice(-4).map((m) => m.text).join(' ');
      const relevantMemories = memoryEnabled && getRelevantMemories
        ? getRelevantMemories(recentText)
        : [];

      const result = await callChatFunction(
        updatedMessages,
        tasks,
        events,
        groceryItems,
        memory,
        getProactiveSuggestions?.() ?? [],
        relevantMemories,
      );

      const replyText = result.text;
      const lowerInput = text.toLowerCase();
      const lowerReply = replyText.toLowerCase();

      // Side-effect: auto-add grocery / task from conversation — errors must not crash chat
      try {
        if (
          (lowerReply.includes('grocery list') || lowerReply.includes("i'll add")) &&
          lowerReply.includes('add')
        ) {
          const match = lowerInput.match(/(?:add|buy|get|need|pick up)\s+(.+)/i);
          if (match) await onAddGrocery(match[1].trim(), 'Pantry');
        } else if (
          lowerReply.includes('task list') ||
          (lowerReply.includes('added') && lowerReply.includes('task'))
        ) {
          const match = lowerInput.match(/(?:add|remind me to|i need to)\s+(.+)/i);
          if (match) await onAddTask(match[1].trim());
        }
      } catch (sideErr) {
        console.error('[Chat] Auto-add side effect failed:', sideErr);
      }

      // Side-effect: save wake time — errors must not crash chat
      try {
        const wakeMatch = lowerInput.match(/(?:wake up|get up|start my day) (?:at )?([\d:]+\s*(?:am|pm)?)/i);
        if (wakeMatch && memory) {
          await onUpdateMemory({ ...memory.preferences, preferredWakeTime: wakeMatch[1] });
        }
      } catch (wakeErr) {
        console.error('[Chat] Wake time save failed:', wakeErr);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: replyText,
          timestamp: new Date(),
        },
      ]);

      // Show memory suggestion banner — errors here must not crash chat
      try {
        if (result.memory_suggestion && onSaveMemory && memoryEnabled) {
          const cat = result.memory_suggestion.category as MemoryCategory;
          if (VALID_CATEGORIES.includes(cat)) {
            setPendingSuggestion({ ...result.memory_suggestion, category: cat });
          }
        }
      } catch (memErr) {
        console.error('[Chat] Memory suggestion handling failed:', memErr);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      let friendlyText = "Oops, I lost my train of thought for a second 💛 Try asking me again!";

      if (errMsg === 'network') {
        friendlyText = "I couldn't reach my server. Please check your connection and try again 💛";
      } else if (errMsg.startsWith('http:4')) {
        friendlyText = "I had an authentication issue. Try refreshing the app 💛";
      } else if (errMsg.startsWith('http:5')) {
        friendlyText = "Something went wrong on my end. Please try again in a moment 💛";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: friendlyText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleConfirmMemory() {
    if (!pendingSuggestion || !onSaveMemory) return;
    setSavingMemory(true);
    try {
      await onSaveMemory(pendingSuggestion.category, pendingSuggestion.title, pendingSuggestion.value);
    } catch (err) {
      console.error('[Chat] Memory save failed:', err);
    }
    setSavingMemory(false);
    setPendingSuggestion(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        text: "Got it! I'll keep that in mind 💛",
        timestamp: new Date(),
      },
    ]);
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-4 bg-white border-b border-gray-50">
        <BestieAvatar
          characterId={character ?? 'emma'}
          expression={isTyping ? 'thinking' : 'happy'}
          size="md"
        />
        <div>
          <h1 className="text-sm font-bold text-gray-800">Emma</h1>
          <p className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>Always here for you</p>
        </div>
        {memoryEnabled && savedMemories.length > 0 && (
          <div
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}
          >
            <Brain size={9} />
            {savedMemories.length} {savedMemories.length === 1 ? 'memory' : 'memories'}
          </div>
        )}
        {!memoryEnabled && (
          <div className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">
            <Brain size={9} />
            Memory off
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-2" style={{ scrollbarWidth: 'none' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {msg.role === 'assistant' && (
              <BestieAvatar characterId={character ?? 'emma'} expression="calm" size="sm" className="mb-0.5" />
            )}
            <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'bg-white text-gray-700 shadow-sm border border-gray-50 rounded-bl-sm'
                }`}
                style={msg.role === 'user' ? { backgroundColor: 'var(--theme-primary)' } : {}}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-gray-300 px-1">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-end gap-2">
            <BestieAvatar characterId={character ?? 'emma'} expression="thinking" size="sm" />
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-50">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Memory confirmation banner */}
      {pendingSuggestion && (
        <MemoryConfirmBanner
          suggestion={pendingSuggestion}
          onConfirm={handleConfirmMemory}
          onDismiss={() => setPendingSuggestion(null)}
          saving={savingMemory}
        />
      )}

      {/* Suggested prompts */}
      {messages.length <= 2 && !pendingSuggestion && (
        <div className="shrink-0 px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="shrink-0 text-xs rounded-full px-3 py-2 font-medium whitespace-nowrap active:scale-95 transition-transform"
                style={{ color: 'var(--theme-primary)', backgroundColor: 'var(--theme-primary-light)', border: '1px solid var(--theme-primary-mid)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 pb-24 pt-2 bg-white border-t border-gray-50">
        <div className="flex gap-2 items-center bg-gray-50 rounded-2xl px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask me anything or plan your day…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400 py-1"
            style={{ fontSize: 16 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-all theme-bg-primary"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Wrap with error boundary so render errors stay inside Chat
export default function ChatPage(props: ChatPageProps) {
  return (
    <ChatErrorBoundary>
      <ChatPageInner {...props} />
    </ChatErrorBoundary>
  );
}
