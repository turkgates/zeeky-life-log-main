import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Plus, Send, Mic, MapPin, CheckCircle, Wallet, Moon, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TEST_USER_ID } from '@/lib/activitySupabase';
import { supabase } from '@/lib/supabase';
import { ActionCategory } from '@/types/zeeky';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/useChatStore';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const zeekyChatUrl = 'https://gmcmreinpnhuszxlpgpj.supabase.co/functions/v1/zeeky-chat';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}


const CATEGORY_GRID: { category: ActionCategory | 'custom'; label: string; icon: typeof MapPin; color: string }[] = [
  { category: 'gittim',  label: 'Gittim',    icon: MapPin,      color: '#1E88E5' },
  { category: 'yaptim',  label: 'Yaptım',    icon: CheckCircle, color: '#43A047' },
  { category: 'harcama', label: 'Harcama',   icon: Wallet,      color: '#FB8C00' },
  { category: 'uyudum',  label: 'Uyudum',    icon: Moon,        color: '#7B1FA2' },
  { category: 'izledim', label: 'İzledim',   icon: Play,        color: '#E91E63' },
  { category: 'custom',  label: 'Özel Eylem',icon: Plus,        color: '#78909C' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const {
    messages, isLoaded, offset, hasMore,
    setMessages, prependMessages, addMessage,
    setLoaded, setOffset, setHasMore,
  } = useChatStore();

  const [userName, setUserName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(!isLoaded);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const todayDate = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Load user name
  useEffect(() => {
    supabase
      .from('users')
      .select('full_name')
      .eq('id', TEST_USER_ID)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setUserName((data.full_name as string).split(' ')[0]);
      });
  }, []);

  const loadHistory = useCallback(async (fetchOffset = 0, prepend = false) => {
    const today = new Date().toISOString().split('T')[0];

    const { data, count } = await supabase
      .from('conversations')
      .select('role, content, created_at', { count: 'exact' })
      .eq('user_id', TEST_USER_ID)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)
      .order('created_at', { ascending: false })
      .range(fetchOffset, fetchOffset + 9);

    console.log('Today history:', data?.length, 'total:', count);

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

    // Fetched descending — reverse to chronological order
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
  }, [setMessages, prependMessages, setHasMore, setOffset, setLoaded]);

  // Load on mount (skip if already loaded from a previous visit)
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

  // Smooth scroll on each new message
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

  const sendMessage = useCallback(async (userMessage: string) => {
    // Append user message immediately
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
        .eq('user_id', TEST_USER_ID)
        .single();
      const personality = profileData?.ai_personality || 'balanced';

      const response = await fetch(zeekyChatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          message: userMessage,
          user_id: TEST_USER_ID,
          personality,
        }),
      });
      const data = await response.json();

      if (data.reply) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply as string,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Hata:', error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Bir sorun oluştu, tekrar dene.',
        created_at: new Date().toISOString(),
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [addMessage]);

  const submitChat = useCallback(() => {
    if (!chatInput.trim() || isChatLoading) return;
    const text = chatInput.trim();
    setChatInput('');
    void sendMessage(text);
  }, [chatInput, isChatLoading, sendMessage]);

  const startRecording = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setChatInput(prev => prev + transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const handleCategorySelect = (cat: ActionCategory | 'custom') => {
    setShowCategoryModal(false);
    if (cat === 'custom') {
      navigate('/add');
    } else {
      navigate('/add', { state: { category: cat } });
    }
  };

  return (
    <div
      className="flex flex-col max-w-[430px] mx-auto animate-fade-in"
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">{getGreeting()}{userName ? `, ${userName}` : ''} 👋</h1>
          <p className="text-xs text-muted-foreground capitalize">{todayDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Chat card */}
      <div className="flex-1 mx-4 mb-2 flex flex-col bg-card rounded-2xl shadow-md border border-border overflow-hidden min-h-0">

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 py-3 scrollbar-hide"
        >
          {isLoadingMore && (
            <div className="text-center text-gray-400 text-xs py-2">Yükleniyor...</div>
          )}
          {isLoadingHistory ? (
            <div className="flex justify-center p-4">
              <span className="text-gray-400 text-sm">Yükleniyor...</span>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3 px-2`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                    Z
                  </div>
                )}
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isChatLoading && (
            <div className="flex justify-start mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                Z
              </div>
              <div className="px-3 py-2 rounded-2xl rounded-bl-none bg-gray-100 text-sm flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto scrollbar-hide border-t border-border">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-accent/10 text-accent font-medium active:scale-95"
          >
            Aktivite ekle ➕
          </button>
          <button
            onClick={() => navigate('/finance')}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-accent/10 text-accent font-medium active:scale-95"
          >
            İstatistiklerimi gör 📊
          </button>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isChatLoading && submitChat()}
            placeholder="Zeeky'ye bir şeyler sor veya bugün ne yaptığını anlat..."
            className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          {chatInput.trim() ? (
            <button
              onClick={submitChat}
              disabled={isChatLoading}
              className="w-10 h-10 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-4 h-4 text-accent-foreground" />
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all flex-shrink-0",
                isRecording ? "bg-destructive animate-pulse" : "bg-muted"
              )}
            >
              <Mic className={cn("w-4 h-4", isRecording ? "text-destructive-foreground" : "text-muted-foreground")} />
            </button>
          )}
        </div>
      </div>

      {/* Recording Overlay */}
      {isRecording && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
              <div className="w-4 h-4 rounded-full bg-destructive" />
            </div>
            <p className="text-sm font-medium">Dinliyorum...</p>
            <p className="text-xs text-muted-foreground">Konuşmayı bitirmek için bırakın</p>
          </div>
        </div>
      )}

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/60" onClick={() => setShowCategoryModal(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-6">
              <h3 className="text-base font-semibold mb-4">Ne eklemek istiyorsun?</h3>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_GRID.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.category}
                      onClick={() => handleCategorySelect(item.category)}
                      className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border shadow-sm active:scale-[0.97] transition-transform"
                      style={{ borderLeftWidth: 3, borderLeftColor: item.color }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.color + '20' }}>
                        <Icon className="w-5 h-5" style={{ color: item.color }} />
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
