import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { findOrCreateFriend } from '@/lib/friendsSupabase';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/useChatStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { useAuthStore } from '@/store/useAuthStore';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const zeekyChatUrl    = 'https://gmcmreinpnhuszxlpgpj.supabase.co/functions/v1/zeeky-chat';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';

  const {
    messages, isLoaded, offset, hasMore,
    setMessages, prependMessages, addMessage,
    setLoaded, setOffset, setHasMore,
  } = useChatStore();

  const { unreadCount, setUnreadCount } = useNotificationStore();
  const refreshActivities = useActivityRefresh(s => s.refresh);

  const [userName,         setUserName]         = useState('');
  const [inputText,        setInputText]        = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(!isLoaded);
  const [isLoadingMore,    setIsLoadingMore]    = useState(false);
  const [isChatLoading,    setIsChatLoading]    = useState(false);
  const [isRecording,      setIsRecording]      = useState(false);

  const recognitionRef       = useRef<any>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef          = useRef<HTMLTextAreaElement>(null);

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
  const loadHistory = useCallback(async (fetchOffset = 0, prepend = false) => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];

    const { data, count } = await supabase
      .from('conversations')
      .select('role, content, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)
      .order('created_at', { ascending: false })
      .range(fetchOffset, fetchOffset + 9);

    if (!data || data.length === 0) {
      if (fetchOffset === 0) {
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

    const sorted = [...data].reverse().map((msg, i) => ({
      id: `${fetchOffset + i}-${msg.created_at as string}`,
      role: msg.role as 'user' | 'assistant',
      content: msg.content as string,
      created_at: msg.created_at as string,
    }));

    if (prepend) {
      const container = messagesContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      prependMessages(sorted);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
      });
    } else {
      setMessages(sorted);
    }

    setHasMore((count ?? 0) > fetchOffset + 10);
    setOffset(fetchOffset + 10);
    setLoaded(true);
  }, [setMessages, prependMessages, setHasMore, setOffset, setLoaded, userId]);

  // Load on mount
  useEffect(() => {
    if (isLoaded) return;
    setIsLoadingHistory(true);
    void loadHistory(0, false).finally(() => setIsLoadingHistory(false));
  }, [isLoaded, loadHistory]);

  // Instant scroll to bottom after initial load
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }
  }, [isLoaded]);

  // Smooth scroll on new messages
  useEffect(() => {
    if (!isLoaded) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoaded]);

  // Pull older messages when scrolled to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || container.scrollTop !== 0 || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    void loadHistory(offset, true).finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, loadHistory, offset]);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    void sendMessage(text);
  }, [inputText, isChatLoading, sendMessage]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

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
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
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
    <div
      className="flex flex-col bg-white max-w-[430px] mx-auto"
      style={{ height: 'calc(100dvh - 64px)' }}
    >

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-none px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-800 text-base">
              {getGreeting()}{userName ? `, ${userName}` : ''} 👋
            </h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{todayDate}</p>
          </div>
          <div className="flex items-center gap-2">
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
            {/* Add button */}
            <button
              onClick={() => navigate('/add')}
              className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-light leading-none active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ── Messages area ───────────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ overscrollBehavior: 'contain' }}
      >
        {isLoadingMore && (
          <div className="text-center text-gray-400 text-xs py-2">Yükleniyor...</div>
        )}

        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-full">
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

            {/* Typing indicator */}
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
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Bottom input area ───────────────────────────────────────────────── */}
      <div
        className="flex-none px-4 pt-2 pb-3 border-t border-gray-100 bg-white"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {/* Quick action chips */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => navigate('/add')}
            className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50 active:scale-95 transition-transform"
          >
            + Aktivite ekle
          </button>
          <button
            onClick={() => navigate('/history')}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-gray-50 active:scale-95 transition-transform"
          >
            📊 İstatistiklerimi gör
          </button>
        </div>

        {/* Textarea + send */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Zeeky'ye bir şeyler sor veya bugün ne yaptığını anlat..."
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition-colors max-h-32 min-h-[44px] leading-relaxed"
            rows={1}
          />
          {inputText.trim() ? (
            <button
              onClick={handleSend}
              disabled={isChatLoading}
              className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white disabled:opacity-50 flex-shrink-0 active:scale-95 transition-transform"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-100'
              }`}
            >
              <svg className={`w-4 h-4 ${isRecording ? 'text-white' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Recording overlay ────────────────────────────────────────────────── */}
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
    </div>
  );
}
