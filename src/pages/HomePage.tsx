import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, Mic, Bell, BarChart2 } from 'lucide-react';
import { findOrCreateFriend } from '@/lib/friendsSupabase';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/useChatStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import WeeklySummaryPage from '@/pages/WeeklySummaryPage';
import { useAppSettings } from '@/hooks/useAppSettings';
import zeekyAvatar from '@/assets/zeeky-avatar.png';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const zeekyChatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zeeky-chat`;

const CHAT_FETCH_MS = 30_000;

function assistantErrorContent(language: string, kind: 'timeout' | 'connection' | 'empty'): string {
  if (language === 'en') {
    if (kind === 'timeout') return 'Sorry, the response took too long. Please try again.';
    if (kind === 'empty') return 'Sorry, I could not generate a response. Please try again.';
    return 'A connection error occurred. Please try again.';
  }
  if (language === 'fr') {
    if (kind === 'timeout') return 'Désolé, la réponse a pris trop de temps. Veuillez réessayer.';
    if (kind === 'empty') return 'Désolé, je n\'ai pas pu générer de réponse. Veuillez réessayer.';
    return 'Une erreur de connexion s\'est produite. Veuillez réessayer.';
  }
  if (kind === 'timeout') return 'Üzgünüm, yanıt çok uzun sürdü. Lütfen tekrar dene.';
  if (kind === 'empty') return 'Üzgünüm, yanıt üretemedim. Lütfen tekrar dene.';
  return 'Bağlantı hatası oluştu. Lütfen tekrar dene.';
}

const BOTTOM_NAV_HEIGHT = 64;
const TOP_BAR_HEIGHT = 60;
const INPUT_ROW_HEIGHT = 60;

const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

function buildWelcomeMessage(translate: TFunction, userFirstName: string): string {
  const hour = new Date().getHours();
  const timeKey = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const name = userFirstName.trim();
  if (name) {
    return translate(`home.initial_message_${timeKey}_named`, { name });
  }
  return translate(`home.initial_message_${timeKey}`);
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
  const { language } = useLanguageStore();
  const { t, i18n } = useTranslation();
  const { settings } = useAppSettings();

  const [userName,         setUserName]         = useState('');
  const [inputText,        setInputText]        = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(!isLoaded);
  const [isLoadingMore,    setIsLoadingMore]    = useState(false);
  const [isChatLoading,    setIsChatLoading]    = useState(false);
  const [isRecording,      setIsRecording]      = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [messageCount,     setMessageCount]     = useState(0);
  const [isPremium,        setIsPremium]        = useState(false);
  const [showMessageLimitUpgrade, setShowMessageLimitUpgrade] = useState(false);

  const recognitionRef       = useRef<any>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef             = useRef<HTMLTextAreaElement>(null);
  const loadingOlderRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  const placeholders = [
    t('home.placeholder_1'),
    t('home.placeholder_2'),
    t('home.placeholder_3'),
    t('home.placeholder_4'),
    t('home.placeholder_5'),
    t('home.placeholder_6'),
  ];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('home.greeting_morning');
    if (h < 18) return t('home.greeting_afternoon');
    return t('home.greeting_evening');
  };

  const locale = i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'en' ? 'en-GB' : 'tr-TR';
  const todayDate = new Date().toLocaleDateString(locale, {
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

  // ── Load user plan & daily message count ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const loadUserPlan = async () => {
      const { data } = await supabase
        .from('users')
        .select('plan_type, daily_message_count, daily_message_date')
        .eq('id', userId)
        .single();
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const isNewDay = data.daily_message_date !== today;
        setMessageCount(isNewDay ? 0 : (data.daily_message_count as number | null ?? 0));
        setIsPremium(data.plan_type === 'premium');
      }
    };
    void loadUserPlan();
  }, [userId]);

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
          content: buildWelcomeMessage(t, userName),
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
  }, [setMessages, prependMessages, setHasMore, setLoaded, userId, t, userName]);

  useEffect(() => {
    if (!isLoaded) return;
    const msgs = useChatStore.getState().messages;
    if (msgs.length !== 1 || msgs[0].id !== 'welcome') return;
    const content = buildWelcomeMessage(t, userName);
    if (msgs[0].content === content) return;
    setMessages([{ ...msgs[0], content }]);
  }, [language, userName, isLoaded, t, setMessages]);

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

  const scrollToBottom = useCallback((smooth = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [isLoaded, scrollToBottom]);

  useEffect(() => {
    if (loadingOlderRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    const len = messages.length;
    if (len === 0) {
      prevMessageCountRef.current = 0;
      return;
    }
    if (prevMessageCountRef.current === 0) {
      prevMessageCountRef.current = len;
      return;
    }
    if (len !== prevMessageCountRef.current) {
      prevMessageCountRef.current = len;
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const handleResize = () => {
      window.setTimeout(() => {
        const el = messagesContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    setShowMessageLimitUpgrade(false);

    try {
      setIsChatLoading(true);

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('ai_personality')
        .eq('user_id', userId)
        .single();
      const personality = profileData?.ai_personality || 'balanced';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHAT_FETCH_MS);

      let response: Response;
      try {
        response = await fetch(zeekyChatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ message: userMessage, user_id: userId, personality, language }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.status === 429) {
        const errData = (await response.json()) as { error?: string; limit?: number };
        if (errData.error === 'message_limit_reached') {
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: t('home.limit_reached', { limit: errData.limit ?? settings.free_daily_messages }),
            created_at: new Date().toISOString(),
          });
          setShowMessageLimitUpgrade(true);
          return;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = (await response.json()) as {
        reply?: string;
        extracted_data?: { activities?: Array<{ people?: string[] }>; has_activity?: boolean; has_transaction?: boolean; transactions?: unknown };
      };

      console.log('Zeeky full response:', JSON.stringify(data));
      console.log('Extracted data:', data.extracted_data);
      console.log('Has activity:', data.extracted_data?.has_activity);
      console.log('Activities:', data.extracted_data?.activities);
      console.log('Has transaction:', data.extracted_data?.has_transaction);
      console.log('Transactions:', data.extracted_data?.transactions);

      const reply = typeof data.reply === 'string' ? data.reply : '';
      if (reply.trim()) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply,
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

        setMessageCount(c => c + 1);
        refreshActivities();
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantErrorContent(language, 'empty'),
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const isAbort =
        (err instanceof Error && err.name === 'AbortError') ||
        (err instanceof DOMException && err.name === 'AbortError');
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantErrorContent(language, isAbort ? 'timeout' : 'connection'),
        created_at: new Date().toISOString(),
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [addMessage, refreshActivities, userId, language, settings.free_daily_messages, t]);

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
      {/* Üst bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          minHeight: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          zIndex: 40,
        }}
        className="flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 box-border pt-safe"
      >
        <div>
          <h1 className="font-semibold text-gray-800 dark:text-gray-100">
            {getGreeting()}{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p className="text-xs text-gray-400 capitalize">{todayDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isPremium && (
            <span className={`text-xs font-medium tabular-nums ${Math.max(0, settings.free_daily_messages - messageCount) === 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {t('home.messages_left', { count: Math.max(0, settings.free_daily_messages - messageCount) })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowWeeklySummary(true)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            aria-label="Bu haftanı gör"
            title="Bu haftanı gör"
          >
            <BarChart2 size={20} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            aria-label="Bildirimler"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mesajlar */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          position: 'fixed',
          top: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          left: 0,
          right: 0,
          bottom: `calc(${BOTTOM_NAV_HEIGHT + INPUT_ROW_HEIGHT}px + ${SAFE_BOTTOM})`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
        className="px-4 py-3 bg-white dark:bg-gray-900"
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
                  <img
                    src={zeekyAvatar}
                    alt="Zeeky"
                    className="w-8 h-8 rounded-full object-contain bg-gradient-to-br from-blue-500 to-purple-600 p-1 mr-2 flex-shrink-0 mt-1"
                  />
                )}
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {showMessageLimitUpgrade && (
              <div className="flex justify-start mb-3">
                <img
                  src={zeekyAvatar}
                  alt=""
                  aria-hidden
                  className="w-8 h-8 rounded-full object-contain bg-gradient-to-br from-blue-500 to-purple-600 p-1 mr-2 flex-shrink-0 mt-1 opacity-0 pointer-events-none select-none"
                />
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="mt-0 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium active:scale-[0.98] transition-transform"
                >
                  {t('settings.upgrade_to_premium')}
                </button>
              </div>
            )}

            {isChatLoading && (
              <div className="flex justify-start mb-3">
                <img
                  src={zeekyAvatar}
                  alt="Zeeky"
                  className="w-8 h-8 rounded-full object-contain bg-gradient-to-br from-blue-500 to-purple-600 p-1 mr-2 flex-shrink-0"
                />
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-none">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          position: 'fixed',
          bottom: `calc(${BOTTOM_NAV_HEIGHT}px + ${SAFE_BOTTOM})`,
          left: 0,
          right: 0,
          zIndex: 40,
        }}
        className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            type="button"
            onClick={() => navigate('/add')}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            aria-label="Ekle"
          >
            <Plus size={20} className="text-gray-600 dark:text-gray-300" />
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
            className="flex-1 min-w-0 resize-none rounded-3xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-700 transition-colors"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />

          {inputText.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isChatLoading}
              className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white disabled:opacity-50 active:scale-95 transition-transform"
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
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
              aria-label="Sesli giriş"
            >
              <Mic size={20} className={isRecording ? 'text-white' : 'text-gray-600 dark:text-gray-300'} />
            </button>
          )}
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
          <p className="text-sm font-semibold text-gray-800">{t('home.listening')}</p>
          <p className="text-xs text-gray-400">{t('home.listening_hint')}</p>
          </div>
        </div>
      )}
    </>
  );
}
