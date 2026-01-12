import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
// Updated import to point to the new public API file
import { sendMessageToGemini } from '../gemini-api.js';

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hey! I'm here to help with your project. What do you need?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      // Mock context - in a real app this would come from the active project state
      const context = "Current View: Dashboard. Active Projects: 3. Open Issues: 5.";
      const responseText = await sendMessageToGemini(userMessage, context);
      
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'error', content: "Failed to get response. Please check your configuration." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-300 z-50 hover:scale-105 hover:shadow-blue-500/50 ${isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
        title="AI Project Assistant"
      >
        <Sparkles size={24} />
      </button>

      {/* Chat Interface */}
      <div 
        className={`fixed bottom-6 right-6 w-[380px] h-[520px] bg-[#0d0d0f] border border-white/10 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden transition-all duration-300 origin-bottom-right backdrop-blur-xl ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bot size={20} className="text-blue-500" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            </div>
            <h4 className="text-sm font-semibold text-gray-50 tracking-wide">Project Assistant</h4>
          </div>
          <button 
            onClick={toggleChat}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-transparent scrollbar-hide">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] px-4 py-3 text-[13px] leading-relaxed tracking-wide ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-[16px_16px_4px_16px] shadow-lg shadow-blue-500/20' 
                    : msg.role === 'error'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-[16px_16px_16px_4px]'
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-[16px_16px_16px_4px]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-[16px_16px_16px_4px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02]">
          <div className="flex gap-2 relative">
            <input 
              ref={inputRef}
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything..." 
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all shadow-inner"
              disabled={isTyping}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-lg shadow-blue-500/20"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatWidget;
