import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkGfm from 'remark-gfm';

interface Message {
  id?: string;
  role: 'user' | 'model';
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface ChatBotProps {
  embedded?: boolean;
}

export const ChatBot: React.FC<ChatBotProps> = ({ embedded = false }) => {
  const { api, token } = useAuth();
  const [isOpen, setIsOpen] = useState(embedded);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<'md' | 'lg' | 'xl'>('md');

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const { data } = await api.get('/chat/conversations');
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, [api]);

  // Load messages for a conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const { data } = await api.get(`/chat/conversations/${conversationId}`);
      setMessages(data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at
      })));
      setCurrentConversationId(conversationId);
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  // Create new conversation
  const createNewConversation = useCallback(async () => {
    try {
      const { data } = await api.post('/chat/conversations');
      setCurrentConversationId(data.id);
      setMessages([{
        role: 'model',
        content: '¡Hola! Soy Stocks Bot. Puedo ayudarte a analizar tu portafolio, explicarte términos financieros o darte insights sobre tus inversiones. ¿En qué puedo ayudarte?'
      }]);
      await loadConversations();
      setShowHistory(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  }, [api, loadConversations]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Create conversation if none exists
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const { data } = await api.post('/chat/conversations');
        conversationId = data.id;
        setCurrentConversationId(data.id);
      } catch (error) {
        console.error('Error creating conversation:', error);
        return;
      }
    }

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsgId = Date.now().toString();
    const tempAiMsgId = (Date.now() + 1).toString();

    setMessages(prev => [
      ...prev,
      { id: tempUserMsgId, role: 'user', content: userMessage, created_at: new Date().toISOString() },
      { id: tempAiMsgId, role: 'model', content: '', created_at: new Date().toISOString() } // Empty AI message placeholder
    ]);

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        aiContent += text;

        // Update the last message (AI) with new content
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'model') {
            lastMsg.content = aiContent;
          }
          return newMsgs;
        });
      }

      // Refresh conversations list to update title deferred
      loadConversations();

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev.slice(0, -1), { // Remove placeholder and show error
        role: 'model',
        content: 'Vaya, parece que hay un problema de conexión. Intenta de nuevo.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete current conversation
  const deleteConversation = async () => {
    if (!currentConversationId) return;
    if (!confirm('¿Eliminar esta conversación?')) return;

    try {
      await api.delete(`/chat/conversations/${currentConversationId}`);
      setCurrentConversationId(null);
      setMessages([]);
      await loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Delete ALL conversations
  const deleteAllConversations = async () => {
    if (!confirm('⚠️ ¿Eliminar TODAS las conversaciones? Esta acción no se puede deshacer.')) return;

    try {
      await api.delete('/chat/conversations');
      setConversations([]);
      setCurrentConversationId(null);
      setMessages([]);
      setShowHistory(false);
    } catch (error) {
      console.error('Error deleting all conversations:', error);
    }
  };

  // Initialize - in embedded mode, check URL for conversationId
  useEffect(() => {
    if (isOpen || embedded) {
      loadConversations();

      // If embedded, check URL for conversation ID
      if (embedded) {
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const convId = urlParams.get('id');
        if (convId) {
          loadConversation(convId);
        }
      }
    }
  }, [isOpen, embedded, loadConversations, loadConversation]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleSize = () => {
    if (size === 'md') setSize('lg');
    else if (size === 'lg') setSize('xl');
    else setSize('md');
  };

  const handlePopOut = () => {
    // Ensure session is available in new window by copying to localStorage
    const sessionToken = sessionStorage.getItem('token');
    const sessionUser = sessionStorage.getItem('user');

    if (sessionToken) {
      // Copy session to localStorage so popup window can access it
      localStorage.setItem('token', sessionToken);
      localStorage.setItem('user', sessionUser || '');
      localStorage.setItem('rememberMe', 'true');
    }

    // Pass current conversation ID if exists
    const url = currentConversationId
      ? `/#/chat?id=${currentConversationId}`
      : '/#/chat';

    window.open(url, 'StocksChatBot', 'width=600,height=800,menubar=no,toolbar=no,location=no,status=no');
    setIsOpen(false);
  };

  // Closed state (floating button)
  if (!isOpen && !embedded) {
    return (
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative size-16 bg-primary text-black rounded-[2rem] shadow-2xl flex items-center justify-center hover:scale-110 hover:-rotate-6 active:scale-95 transition-all duration-300 ring-4 ring-primary/20"
        >
          <span className="material-symbols-outlined text-3xl font-bold">chat</span>
          <div className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full border-2 border-white dark:border-background-dark animate-pulse"></div>
        </button>
      </div>
    );
  }

  const sizeClasses = {
    md: 'w-[400px] md:w-[480px] h-[650px]',
    lg: 'w-[550px] h-[750px]',
    xl: 'w-[700px] h-[850px]'
  };

  const containerBaseClass = embedded
    ? 'w-full h-full flex flex-col bg-white dark:bg-surface-dark'
    : `flex flex-col ${sizeClasses[size]} bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] shadow-2xl overflow-hidden transition-all animate-in zoom-in-95 duration-300`;

  const wrapperClass = embedded
    ? 'w-full h-screen bg-background-light dark:bg-background-dark'
    : 'fixed bottom-8 right-8 z-50 flex items-end justify-end';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  if (!isOpen && !embedded) {
    return (
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative size-16 bg-primary text-black rounded-[2rem] shadow-2xl flex items-center justify-center hover:scale-110 hover:-rotate-6 active:scale-95 transition-all duration-300 ring-4 ring-primary/20"
        >
          <span className="material-symbols-outlined text-3xl font-bold">chat</span>
          <div className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full border-2 border-white dark:border-background-dark animate-pulse"></div>
        </button>
      </div>
    );
  }
  return (
    <div className={wrapperClass}>
      <div className={containerBaseClass}>

        {/* Header */}
        <div className="bg-[#1a1a14] p-4 md:p-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="size-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              title="Historial de conversaciones"
            >
              <span className="material-symbols-outlined">{showHistory ? 'close' : 'menu'}</span>
            </button>
            <div>
              <h3 className="font-bold leading-tight">Stocks Bot</h3>
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold">
                {currentConversationId ? 'Conversación activa' : 'Nueva conversación'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={createNewConversation}
              className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-green-400 transition-colors"
              title="Nueva conversación"
            >
              <span className="material-symbols-outlined text-lg">add_comment</span>
            </button>
            {currentConversationId && (
              <button
                onClick={deleteConversation}
                className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-red-400 transition-colors"
                title="Eliminar conversación actual"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            )}
            {!embedded && (
              <>
                <button onClick={toggleSize} className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors" title="Cambiar tamaño">
                  <span className="material-symbols-outlined text-lg">aspect_ratio</span>
                </button>
                <button onClick={handlePopOut} className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors" title="Abrir en ventana">
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                </button>
                <button onClick={() => setIsOpen(false)} className="size-8 flex items-center justify-center hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex relative min-h-0 overflow-hidden">

          {/* History Panel - Absolute positioned overlay with high Z-index */}
          {showHistory && (
            <div className="absolute inset-0 z-50 flex bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-64 max-w-[80%] bg-white dark:bg-[#1a1a14] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 h-full border-r border-white/10">
                <div className="p-4 border-b border-border-light dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-text-secondary-light dark:text-gray-400 tracking-wider">
                    Historial
                  </h4>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {loadingConversations ? (
                    <div className="p-8 text-center text-xs opacity-50 flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined animate-spin">refresh</span>
                      Cargando...
                    </div>
                  ) : !Array.isArray(conversations) || conversations.length === 0 ? (
                    <div className="p-8 text-center text-xs opacity-50 italic">
                      No hay conversaciones guardadas
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {conversations.map(conv => (
                        <button
                          key={conv.id}
                          onClick={() => {
                            loadConversation(conv.id);
                            if (window.innerWidth < 768) setShowHistory(false);
                          }}
                          className={`w-full p-4 text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-all border-b border-border-light/50 dark:border-white/5 group relative ${conv.id === currentConversationId
                            ? 'bg-primary/5 dark:bg-primary/10'
                            : ''
                            }`}
                        >
                          {conv.id === currentConversationId && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                          )}
                          <p className={`text-sm font-medium truncate ${conv.id === currentConversationId ? 'text-primary' : 'text-gray-700 dark:text-gray-200'
                            }`}>
                            {conv.title || 'Nueva conversación'}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                            {formatDate(conv.updated_at)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete All Button */}
                {Array.isArray(conversations) && conversations.length > 0 && (
                  <div className="p-2 border-t border-border-light dark:border-white/10 bg-gray-50 dark:bg-white/5">
                    <button
                      onClick={() => {
                        if (confirm('¿Seguro que quieres borrar todo el historial?')) deleteAllConversations();
                      }}
                      className="w-full p-3 rounded-xl text-xs text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      Borrar todo el historial
                    </button>
                  </div>
                )}
              </div>

              {/* Click outside to close */}
              <div className="flex-1" onClick={() => setShowHistory(false)} />
            </div>
          )}

          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 no-scrollbar bg-gray-50 dark:bg-black/10">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-primary">smart_toy</span>
                  </div>
                  <h3 className="font-bold mb-2">¡Hola!</h3>
                  <p className="text-sm opacity-60 max-w-[200px]">
                    Inicia una conversación o selecciona una del historial.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={m.id || i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${m.role === 'user'
                      ? 'bg-primary text-black rounded-tr-none shadow-lg shadow-primary/10'
                      : 'bg-white dark:bg-surface-dark-elevated text-text-primary-light dark:text-gray-100 rounded-tl-none border border-border-light dark:border-border-dark shadow-sm'
                      }`}>
                      {m.role === 'model' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
                            h3: ({ children }) => <h3 className="font-bold text-base mt-3 mb-1">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="ml-2">{children}</li>,
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full border-collapse text-xs table-auto">{children}</table></div>,
                            thead: ({ children }) => <thead className="bg-gray-100 dark:bg-white/10">{children}</thead>,
                            tbody: ({ children }) => <tbody className="divide-y divide-border-light dark:divide-white/10">{children}</tbody>,
                            tr: ({ children }) => <tr className="hover:bg-primary/5 dark:hover:bg-white/5 transition-colors">{children}</tr>,
                            th: ({ children }) => <th className="border border-border-light dark:border-white/10 p-2 text-left font-bold whitespace-nowrap">{children}</th>,
                            td: ({ children }) => <td className="border border-border-light dark:border-white/10 p-2 whitespace-nowrap">{children}</td>,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                    {m.created_at && (
                      <span className="text-[10px] opacity-40 mt-1.5 font-bold uppercase">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl w-fit">
                  <div className="flex gap-1">
                    <div className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="size-1.5 bg-primary rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs font-bold text-primary italic">Procesando...</span>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-surface-dark border-t border-border-light dark:border-border-dark shrink-0">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Escribe tu pregunta..."
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

      </div>
    </div>
  );
};
