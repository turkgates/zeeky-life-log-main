import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Plus, Send, Mic, MapPin, CheckCircle, Wallet, Moon, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TEST_USER_ID } from '@/lib/activitySupabase';
import { supabase } from '@/lib/supabase';
import { ActionCategory } from '@/types/zeeky';
import { cn } from '@/lib/utils';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const zeekyChatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zeeky-chat`;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

const CATEGORY_GRID: { category: ActionCategory | 'custom'; label: string; icon: typeof MapPin; color: string }[] = [
  { category: 'gittim',   label: 'Gittim',      icon: MapPin,      color: '#1E88E5' },
  { category: 'yaptim',   label: 'Yaptım',       icon: CheckCircle, color: '#43A047' },
  { category: 'harcama',  label: 'Harcama',      icon: Wallet,      color: '#FB8C00' },
  { category: 'uyudum',   label: 'Uyudum',       icon: Moon,        color: '#7B1FA2' },
  { category: 'izledim',  label: 'İzledim',      icon: Play,        color: '#E91E63' },
  { category: 'custom',   label: 'Özel Eylem',   icon: Plus,        color: '#78909C' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', text: 'Merhaba! Ben Zeeky. Bugün nasıl geçti? Ne yaptığını anlat, sana yardımcı olayım. 🌟' },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const todayDate = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    supabase
      .from('users')
      .select('full_name')
      .eq('id', TEST_USER_ID)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setUserName(data.full_name.split(' ')[0]);
      });
  }, []);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isChatLoading]);

  const addMessage = useCallback((msg: { role: 'user' | 'assistant'; content: string }) => {
    setMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: msg.role,
        text: msg.content,
      },
    ]);
  }, []);

  const sendMessage = useCallback(async (userMessage: string) => {
    try {
      setIsChatLoading(true);

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('ai_personality')
        .eq('user_id', TEST_USER_ID)
        .single();
      const personality = profileData?.ai_personality || 'balanced';

      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Function URL:', zeekyChatUrl);
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
        addMessage({ role: 'assistant', content: data.reply });
      }
    } catch (error) {
      console.error('Hata:', error);
      addMessage({ role: 'assistant', content: 'Bir sorun oluştu, tekrar dene.' });
    } finally {
      setIsChatLoading(false);
    }
  }, [addMessage]);

  const submitChat = useCallback(() => {
    if (!chatInput.trim() || isChatLoading) return;
    const text = chatInput.trim();
    addMessage({ role: 'user', content: text });
    setChatInput('');
    void sendMessage(text);
  }, [chatInput, isChatLoading, addMessage, sendMessage]);

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

      {/* Chat card — fills remaining space */}
      <div className="flex-1 mx-4 mb-2 flex flex-col bg-card rounded-2xl shadow-md border border-border overflow-hidden min-h-0">

        {/* Messages */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide"
        >
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex items-end gap-2", msg.role === 'user' ? "justify-end" : "justify-start")}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5">
                  <span className="text-[11px] font-bold text-primary-foreground">Z</span>
                </div>
              )}
              <div className={cn(
                "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                msg.role === 'user'
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}>
                {msg.text}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5">
                <span className="text-[11px] font-bold text-primary-foreground">Z</span>
              </div>
              <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-muted text-foreground text-sm flex items-center gap-1.5 shadow-sm">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
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
