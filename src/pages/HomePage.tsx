import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, Mic } from 'lucide-react';
import { findOrCreateFriend } from '@/lib/friendsSupabase';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/useChatStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { useAuthStore } from '@/store/useAuthStore';
import WeeklySummaryPage from '@/pages/WeeklySummaryPage';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const zeekyChatUrl    = 'https://gmcmreinpnhuszxlpgpj.supabase.co/functions/v1/zeeky-chat';

const placeholders = [
  'Bugün ne yaptın?',
  'Zeeky ile sohbet et...',
  'Kendini nasıl hissediyorsun?',
  'Bugün neler geçti?',
  'Bir şeyler anlat...',
  'Hedeflerini konuşalım mı?',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/** DB desc+limit ile gelen satırları kronolojik sıraya çevir (reverse yerine sort). */
function mapConversationRows(
  data: Array<{ role: unknown; content: unknown; created_at: unknown }>,
) {
  const sorted = [...data].sort(
    (a, b) =>
      new Date(String(a.created_at)).getTime() -
      new Date(String(b.created_at)).getTime(),
  );
  return sorted.map((msg, i) => ({
    id: `${String(msg.created_at)}-${i}-${String(msg.role)}`,
    role: msg.role as 'user' | 'assistant',
    content: String(msg.content ?? ''),
    created_at: String(msg.created_at),
  }));
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';

  const {
    messages, isLoaded, hasMore,
    setMessages, prependMessages, addMessage,
    setLoaded, setHasMore, setScrollPosition,
  } = useChatStore();

  const { unreadCount, setUnreadCount } = useNotificationStore();
  const refreshActivities = useActivityRefresh(s => s.refresh);

  const [userName,         setUserName]         = useState('');
  const [inputText,        setInputText]        = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(!isLoaded);
  const [isLoadingMore,    setIsLoadingMore]    = useState(false);
  const [isChatLoading,    setIsChatLoading]    = useState(false);
  const [isRecording,      setIsRecording]      = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const recognitionRef       = useRef<any>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef             = useRef<HTMLTextAreaElement>(null);
  const loadingOlderRef = useRef(false);

  const todayDate = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // ── Fetch unread count ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    void run();
  }, [setUnreadCount, userId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  // ── Load user name (metadata first, then users table) ─────────────────────
  useEffect(() => {
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    if (meta?.full_name?.trim()) {
      setUserName(meta.full_name.trim().split(' ')[0]);
      return;
    }
    if (!userId) return;
    supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setUserName((data.full_name as string).split(' ')[0]);
      });
  }, [user, userId]);

  // ── Load chat history ─────────────────────────────────────────────────────
  // İlk yükleme: bugünün son 20 mesajı (desc+limit), sonra kronolojik sıra için sort.
  // Daha eskiler: mevcut en eski tarihten öncekiler, prepend ile dizinin başına.
  const loadHistory = useCallback(async (prepend = false) => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];

    let q = supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`);

    if (prepend) {
      const oldest = useChatStore.getState().messages[0]?.created_at;
      if (!oldest) return;
      q = q.lt('created_at', oldest);
    }

    const { data, error } = await q.order('created_at', { ascending: false }).limit(20);

    if (error) {
      console.error('loadHistory:', error);
      setLoaded(true);
      return;
    }

    if (!data || data.length === 0) {
      if (!prepend) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: 'Merhaba! Ben Zeeky. Bugün nasıl geçti? ✨',
          created_at: new Date().toISOString(),
        }]);
      }
      setHasMore(false);
      setLoaded(true);
      return;
    }

    const rows = mapConversationRows(data);

    if (prepend) {
      loadingOlderRef.current = true;
      const container = messagesContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      prependMessages(rows);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
          loadingOlderRef.current = false;
        });
      });
    } else {
      setMessages(rows);
    }

    setHasMore(data.length === 20);
    setLoaded(true);
  }, [setMessages, prependMessages, setHasMore, setLoaded, userId]);

  // Load on mount
  useEffect(() => {
    if (isLoaded) return;
    setIsLoadingHistory(true);
    void loadHistory(false).finally(() => setIsLoadingHistory(false));
  }, [isLoaded, loadHistory]);

  // Sayfadan ayrılırken kaydırma pozisyonunu sakla
  useEffect(() => {
    return () => {
      const container = messagesContainerRef.current;
      if (container) {
        setScrollPosition(container.scrollTop);
      }
    };
  }, [setScrollPosition]);

  useEffect(() => {
    if (!isLoaded) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (loadingOlderRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages.length, isLoaded]);

  // Pull older messages when scrolled to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || container.scrollTop !== 0 || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    void loadHistory(true).finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, loadHistory]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userId) return;
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    });

    try {
      setIsChatLoading(true);

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('ai_personality')
        .eq('user_id', userId)
        .single();
      const personality = profileData?.ai_personality || 'balanced';

      const response = await fetch(zeekyChatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ message: userMessage, user_id: userId, personality }),
      });
      const data = await response.json();
      console.log('Zeeky full response:', JSON.stringify(data));
      console.log('Extracted data:', data.extracted_data);
      console.log('Has activity:', data.extracted_data?.has_activity);
      console.log('Activities:', data.extracted_data?.activities);
      console.log('Has transaction:', data.extracted_data?.has_transaction);
      console.log('Transactions:', data.extracted_data?.transactions);

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (data.reply as string | undefined) || 'Bir sorun oluştu, tekrar dene.',
        created_at: new Date().toISOString(),
      });

      if (data.extracted_data?.activities) {
        for (const activity of data.extracted_data.activities as Array<{ people?: string[] }>) {
          if (activity.people && activity.people.length > 0) {
            for (const personName of activity.people) {
              await findOrCreateFriend(userId, personName);
            }
          }
        }
      }

      // Edge Function persists activities/transactions; refresh lists that depend on useActivityRefresh
      refreshActivities();
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Bağlantı hatası, tekrar dene.',
        created_at: new Date().toISOString(),
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [addMessage, refreshActivities, userId]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isChatLoading) return;
    setInputText('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    void sendMessage(text);
  }, [inputText, isChatLoading, sendMessage]);

  // ── Voice recording ───────────────────────────────────────────────────────
  const startRecording = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'tr-TR';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript as string;
      setInputText(prev => prev + t);
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
      }
    };
    r.onend = () => setIsRecording(false);
    r.onerror = () => setIsRecording(false);
    recognitionRef.current = r;
    r.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div
      className="bg-white max-w-[430px] mx-auto"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        height: 'calc(100dvh - 64px)',
      }}
    >

      {/* ── Üst bar (auto) ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-800 text-base">
              {getGreeting()}{userName ? `, ${userName}` : ''} 👋
            </h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{todayDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWeeklySummary(true)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg leading-none active:scale-95 transition-transform"
              aria-label="Bu haftanı gör"
              title="Bu haftanı gör"
            >
              📊
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg leading-none active:scale-95 transition-transform"
                aria-label="Bildirimler"
              >
                🔔
              </button>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mesajlar (1fr, scroll) + scroll sonu boşluğu (h-4) ───────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="min-h-0 overflow-y-auto px-4 py-3"
        style={{ overscrollBehavior: 'contain' }}
      >
        {isLoadingMore && (
          <div className="text-center text-gray-400 text-xs py-2">Yükleniyor...</div>
        )}

        {isLoadingHistory ? (
          <div className="flex justify-center items-center min-h-[40%]">
            <span className="text-gray-400 text-sm">Yükleniyor...</span>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                    Z
                  </div>
                )}
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
                  Z
                </div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-none">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* ── Input (auto) — yükseklik calc(100dvh - 64px) ile BottomNav payı düşülmüş ─ */}
      <div
        className="bg-white border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            type="button"
            onClick={() => navigate('/add')}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
            aria-label="Ekle"
          >
            <Plus size={20} className="text-gray-600" />
          </button>

          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholders[placeholderIndex]}
            rows={1}
            className="flex-1 min-w-0 resize-none rounded-3xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />

          {inputText.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isChatLoading}
              className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50"
              aria-label="Gönder"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600'
              }`}
              aria-label="Sesli giriş"
            >
              <Mic size={20} className={isRecording ? 'text-white' : 'text-gray-600'} />
            </button>
          )}
        </div>
      </div>
    </div>

    <WeeklySummaryPage
      isOpen={showWeeklySummary}
      onClose={() => setShowWeeklySummary(false)}
    />

    {isRecording && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl mx-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
            <div className="w-5 h-5 rounded-full bg-red-500" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Dinliyorum...</p>
          <p className="text-xs text-gray-400">Konuşmayı bitirmek için bırakın</p>
        </div>
      </div>
    )}
    </>
  );
}
