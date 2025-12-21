import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';

interface ChatBotProps {
  embedded?: boolean;
}

export const ChatBot: React.FC<ChatBotProps> = ({ embedded = false }) => {
  const { api } = useAuth();
  const [isOpen, setIsOpen] = useState(embedded);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<'md' | 'lg' | 'xl'>('md');

  // Cargar historial de localStorage persistente
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('stocks_chat_history');
      if (saved) {
        return JSON.parse(saved).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }
    } catch (e) {
      console.error('Error loading chat history', e);
    }
    return [{
      role: 'model',
      text: '¡Hola! Soy Stocks Bot. Puedo ayudarte a analizar tu riesgo, explicarte términos financieros o darte insights sobre tu portafolio. ¿Qué tienes en mente?',
      timestamp: new Date()
    }];
  });

  // Persistir historial en localStorage
  useEffect(() => {
    localStorage.setItem('stocks_chat_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Sincronizar historial entre ventanas/pestañas en tiempo real
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stocks_chat_history' && e.newValue) {
        try {
          const newHistory = JSON.parse(e.newValue).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(newHistory);
        } catch (err) {
          console.error('Error syncing chat history', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const currentInput = input;
    const userMsg: ChatMessage = { role: 'user', text: currentInput, timestamp: new Date() };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        text: m.text
      }));

      const { data } = await api.post<{ answer: string }>('/ai/chat', { messages: conversationHistory });

      const aiMsg: ChatMessage = {
        role: 'model',
        text: data.answer || 'No pude obtener una respuesta del servidor.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: 'Vaya, parece que hay un problema de conexión con el núcleo de Gemini (Server).', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (confirm('¿Estás seguro de que quieres borrar toda la conversación?')) {
      const initialMsg: ChatMessage = {
        role: 'model',
        text: '¡Hola de nuevo! He olvidado todo lo anterior. ¿En qué puedo ayudarte ahora?',
        timestamp: new Date()
      };
      setMessages([initialMsg]);
    }
  };

  const toggleSize = () => {
    if (size === 'md') setSize('lg');
    else if (size === 'lg') setSize('xl');
    else setSize('md');
  };

  const handlePopOut = () => {
    // Abrir ventana emergente
    window.open('/chat', 'StocksChatBot', 'width=500,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
    setIsOpen(false);
  };

  // Render cerrado (solo icono)
  if (!isOpen && !embedded) {
    return (
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative size-16 bg-primary text-black rounded-[2rem] shadow-2xl flex items-center justify-center hover:scale-110 hover:-rotate-6 active:scale-95 transition-all duration-300 ring-4 ring-primary/20"
        >
          <span className="material-symbols-outlined text-3xl font-bold">chat</span>
          <div className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full border-2 border-white dark:border-background-dark animate-pulse"></div>
          <div className="absolute right-full mr-4 bg-[#1a1a14] text-white text-[10px] font-bold py-2 px-4 rounded-full opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap shadow-xl">
            ¿Necesitas ayuda financiera?
          </div>
        </button>
      </div>
    );
  }

  // Clases según tamaño
  const sizeClasses = {
    md: 'w-[350px] md:w-[420px] h-[600px]',
    lg: 'w-[500px] h-[700px]',
    xl: 'w-[600px] h-[850px]'
  };

  const containerBaseClass = embedded
    ? 'w-full h-full flex flex-col bg-white dark:bg-surface-dark' // Modo embedded (pantalla completa o dentro de div)
    : `flex flex-col ${sizeClasses[size]} bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] shadow-2xl overflow-hidden transition-all animate-in zoom-in-95 duration-300`;

  const wrapperClass = embedded
    ? 'w-full h-screen bg-background-light dark:bg-background-dark' // Full screen wrapper
    : 'fixed bottom-8 right-8 z-50 flex items-end justify-end'; // Fixed wrapper

  return (
    <div className={wrapperClass}>
      <div className={containerBaseClass}>

        {/* Header */}
        <div className="bg-[#1a1a14] p-4 md:p-6 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-black">
              <span className="material-symbols-outlined font-bold">smart_toy</span>
            </div>
            <div>
              <h3 className="font-bold leading-tight">Stocks Bot</h3>
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Online • Financial AI</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-red-400 transition-colors"
              title="Borrar conversación y empezar de nuevo"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>

            {!embedded && (
              <>
                <button
                  onClick={toggleSize}
                  className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                  title="Cambiar tamaño"
                >
                  <span className="material-symbols-outlined text-lg">aspect_ratio</span>
                </button>
                <button
                  onClick={handlePopOut}
                  className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                  title="Abrir en ventana separada"
                >
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 no-scrollbar bg-gray-50 dark:bg-black/10">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[90%] p-4 rounded-3xl text-sm leading-relaxed ${m.role === 'user'
                ? 'bg-primary text-black rounded-tr-none shadow-lg shadow-primary/10'
                : 'bg-white dark:bg-surface-dark-elevated text-text-primary-light dark:text-gray-100 rounded-tl-none border border-border-light dark:border-border-dark shadow-sm'
                }`}>
                {m.text}
              </div>
              <span className="text-[10px] opacity-40 mt-1.5 font-bold uppercase">{m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl w-fit">
              <div className="flex gap-1">
                <div className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="size-1.5 bg-primary rounded-full animate-bounce"></div>
              </div>
              <span className="text-xs font-bold text-primary italic">Asesor procesando...</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white dark:bg-surface-dark border-t border-border-light dark:border-border-dark shrink-0">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pregunta sobre tu cartera..."
              className="w-full bg-gray-100 dark:bg-background-dark border-none rounded-2xl pl-5 pr-14 py-4 text-sm focus:ring-2 focus:ring-primary outline-none text-text-primary-light dark:text-white transition-all shadow-inner"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 size-11 flex items-center justify-center bg-primary text-black rounded-xl shadow-lg active:scale-95 disabled:opacity-50 transition-all"
            >
              <span className="material-symbols-outlined font-bold">send</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
