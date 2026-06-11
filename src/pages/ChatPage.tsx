import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Task, Event, GroceryItem, UserMemory, Preferences, Goal, WeeklyGroceryList, GroceryCategory } from '../lib/supabase';
import BestieAvatar from '../components/besties/BestieAvatar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
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
}

const SUGGESTED_PROMPTS = [
  "What's next today?",
  'Plan my day',
  'Add groceries',
  'Help me stay organized',
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function callChatFunction(
  messages: Message[],
  tasks: Task[],
  events: Event[],
  groceryItems: GroceryItem[],
  memory: UserMemory | null,
  proactiveSuggestions: string[]
): Promise<string> {
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
  };

  if (memory) {
    context.routines = memory.routines;
    context.preferences = memory.preferences;
    const recentHistory = memory.history.slice(-7);
    context.recentActions = recentHistory.flatMap((h) => h.actions).slice(-20);
    // Pass top groceries sorted by frequency so the AI can suggest them naturally
    context.commonGroceries = [...memory.common_groceries]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map((g) => `${g.name} (${g.category}, x${g.frequency})`);
    context.proactiveSuggestions = proactiveSuggestions;
  }

  const apiMessages = messages
    .filter((m) => m.id !== 'init')
    .map((m) => ({ role: m.role, content: m.text }));

  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ messages: apiMessages, context }),
  });

  if (!response.ok) throw new Error('Chat request failed');

  const data = await response.json();
  return data.text ?? "I'm here for you 💛 Could you say that again?";
}

export default function ChatPage({
  tasks,
  events,
  groceryItems,
  memory,
  onAddTask,
  onAddGrocery,
  onUpdateMemory,
  getProactiveSuggestions,
  preferredName,
  avatarTheme,
  character,
}: ChatPageProps) {
  const initMessage: Message = {
    id: 'init',
    role: 'assistant',
    text: preferredName
      ? `Hey ${preferredName} 💛 I'm here to help you stay on top of things today. What do you need?`
      : "Hey 💛 I'm here to help you stay on track today. What do you need?",
    timestamp: new Date(),
  };
  const [messages, setMessages] = useState<Message[]>([initMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function sendMessage(text: string) {
    if (!text.trim() || isTyping) return;

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
      const replyText = await callChatFunction(updatedMessages, tasks, events, groceryItems, memory, getProactiveSuggestions?.() ?? []);

      // Parse for implicit action intents based on user input + reply
      const lowerInput = text.toLowerCase();
      const lowerReply = replyText.toLowerCase();

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

      // Detect wake time preference mentions
      const wakeMatch = lowerInput.match(/(?:wake up|get up|start my day) (?:at )?([\d:]+\s*(?:am|pm)?)/i);
      if (wakeMatch && memory) {
        await onUpdateMemory({
          ...memory.preferences,
          preferredWakeTime: wakeMatch[1],
        });
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: replyText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: "Oops, I lost my train of thought for a second 💛 Try asking me again!",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
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
          <h1 className="text-sm font-bold text-gray-800">LifeBestie</h1>
          <p className="text-xs text-emerald-500 font-medium">Always here for you</p>
        </div>
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

      {/* Suggested Prompts */}
      {messages.length <= 2 && (
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
