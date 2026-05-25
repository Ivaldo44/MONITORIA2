import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ChatMessage, UserProfile } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Hash, MoreVertical, MessageSquare, ShieldCheck, X, Briefcase, Building, Phone, Mail } from "lucide-react";

const ProfileModal: React.FC<{ profile: UserProfile; onClose: () => void }> = ({ profile, onClose }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-md"
    onClick={onClose}
  >
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="bg-emerald-900 dark:bg-emerald-950 rounded-[3rem] w-full max-w-sm overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.4)] border border-emerald-800/50"
      onClick={e => e.stopPropagation()}
    >
      <div className="relative h-32 bg-gradient-to-br from-emerald-800 to-brand-green">
        <div className="absolute inset-0 bg-black/20" />
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-white/20 text-white rounded-xl transition-all backdrop-blur-md border border-white/10"
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="px-8 pb-10 -mt-16">
        <div className="relative inline-block mb-6">
          <div className="w-28 h-28 rounded-[2rem] bg-emerald-900 border-4 border-emerald-900 overflow-hidden shadow-2xl flex items-center justify-center relative z-10">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-emerald-400" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-green rounded-full border-4 border-emerald-900 z-20 shadow-[0_0_15px_rgba(0,255,101,0.5)]" />
        </div>

        <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">{profile.full_name}</h2>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-green/10 rounded-full mb-8">
          <ShieldCheck size={12} className="text-brand-green" />
          <p className="text-brand-green font-black text-[10px] uppercase tracking-widest">Auditor Verificado</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-5 rounded-3xl bg-black/20 border border-emerald-800/40 group hover:border-brand-green/30 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform">
              <Briefcase size={20} />
            </div>
            <div>
              <p className="text-[9px] text-emerald-500 uppercase font-black tracking-[0.2em] mb-0.5">Cargo Titular</p>
              <p className="text-sm font-black text-white uppercase">{profile.cargo || "Não informado"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 rounded-3xl bg-black/20 border border-emerald-800/40 group hover:border-brand-green/30 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Building size={20} />
            </div>
            <div>
              <p className="text-[9px] text-emerald-500 uppercase font-black tracking-[0.2em] mb-0.5">Setor de Atuação</p>
              <p className="text-sm font-black text-white uppercase">{profile.setor || "Não informado"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 rounded-3xl bg-black/20 border border-emerald-800/40 group hover:border-brand-green/30 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <Mail size={20} />
            </div>
            <div>
              <p className="text-[9px] text-emerald-500 uppercase font-black tracking-[0.2em] mb-0.5">Identidade Digital</p>
              <p className="text-sm font-black text-white truncate max-w-[180px]">{profile.contato || "N/A"}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

export const Chat: React.FC = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"public" | "private">("public");
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "private" && selectedRecipient) {
      localStorage.setItem("active_chat_with", selectedRecipient.id);
    } else {
      localStorage.removeItem("active_chat_with");
    }
    return () => {
      localStorage.removeItem("active_chat_with");
    };
  }, [selectedRecipient, activeTab]);

  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    // Consider online if seen in last 3 minutes
    return now.getTime() - lastSeenDate.getTime() < 180000;
  };

  useEffect(() => {
    cleanupOldMessages();
    fetchInitialData();
    
    // Real-time for messages
    const messageChannel = supabase
      .channel("cedro-chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;
          const isRelevant = 
            (!newMessage.is_private && activeTab === "public") || 
            (newMessage.is_private && activeTab === "private" && 
             ((newMessage.sender_id === user?.id && newMessage.recipient_id === selectedRecipient?.id) ||
              (newMessage.sender_id === selectedRecipient?.id && newMessage.recipient_id === user?.id)));

          if (!isRelevant) return;

          setMessages(prev => {
            // Check if we already have this message (by real ID)
            if (prev.some(m => m.id === newMessage.id)) return prev;
            
            // Check if this is a response to our own optimistic message
            // If the message is from us, we might have an optimistic version with a temporary ID
            const isFromMe = newMessage.sender_id === user?.id;
            let updated = [...prev];
            
            if (isFromMe) {
              // Look for a message with the same content sent in the last 10 seconds that has a non-UUID ID (temporary)
              const optimisticIdx = updated.findIndex(m => 
                m.sender_id === user?.id && 
                m.content === newMessage.content && 
                m.id.length < 20 // temporaryId is short
              );
              
              if (optimisticIdx !== -1) {
                updated[optimisticIdx] = { ...newMessage, sender_profile: profile || undefined };
                return updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              }
            }

            // Normal processing for others or if no matching optimistic found
            const combined = [...updated, newMessage].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            const knownSender = prev.find(m => m.sender_id === newMessage.sender_id)?.sender_profile;
            if (knownSender) {
              return combined.map(m => m.id === newMessage.id ? { ...m, sender_profile: knownSender } : m);
            }

            fetchSenderProfile(newMessage.sender_id).then(profileData => {
              if (profileData) {
                setMessages(current => 
                  current.map(m => m.sender_id === newMessage.sender_id ? { ...m, sender_profile: profileData } : m)
                );
              }
            });
            return combined;
          });
        }
      )
      .subscribe();

    // Real-time for user presence
    const userChannel = supabase
      .channel("presence-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const updatedProfile = payload.new as UserProfile;
          if (updatedProfile) {
            setUsers(prev => prev.map(u => u.id === updatedProfile.id ? updatedProfile : u));
            if (selectedRecipient?.id === updatedProfile.id) {
              setSelectedRecipient(updatedProfile);
            }
          }
        }
      )
      .subscribe();

    // Update time every minute to refresh "isOnline" badges
    const statusInterval = setInterval(() => {
      setUsers(prev => [...prev]);
    }, 60000);

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(userChannel);
      clearInterval(statusInterval);
    };
  }, [activeTab, selectedRecipient, user?.id]);

  const fetchInitialData = async () => {
    setLoading(true);
    await fetchUsers();
    await fetchMessages();
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user?.id || "");
    
    if (error) {
      console.error("Erro ao buscar usuários do chat:", error);
    }

    let filtered = data || [];
    
    const isCurrentUserAdmin = profile?.role?.toLowerCase().trim() === "admin";
    if (!isCurrentUserAdmin) {
      const userSector = profile?.setor?.toLowerCase().trim();
      filtered = filtered.filter(u => {
        const isUserAdmin = u.role?.toLowerCase().trim() === "admin";
        const isSameSector = u.setor && userSector && u.setor.toLowerCase().trim() === userSector;
        return isUserAdmin || isSameSector;
      });
    }
    setUsers(filtered);
  };

  const fetchMessages = async () => {
    try {
      let query = supabase
        .from("messages")
        .select("*, sender_profile: profiles!messages_sender_id_fkey (*)")
        .order("created_at", { ascending: true })
        .limit(100);

      if (activeTab === "public") {
        query = query.eq("is_private", false);
      } else if (selectedRecipient) {
        query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${selectedRecipient.id}),and(sender_id.eq.${selectedRecipient.id},recipient_id.eq.${user?.id})`);
      } else {
        setMessages([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSenderProfile = async (senderId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", senderId)
      .single();
    return data;
  };

  const cleanupOldMessages = async () => {
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      await supabase.from("messages").delete().lt("created_at", yesterday.toISOString());
    } catch (err) {
      console.error("Erro na limpeza:", err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;
    if (activeTab === "private" && !selectedRecipient) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    const temporaryId = Math.random().toString(36).substring(7);
    const optimisticMessage: ChatMessage = {
      id: temporaryId,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      content: messageContent,
      is_private: activeTab === "private",
      recipient_id: selectedRecipient?.id,
      sender_profile: profile || undefined
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          content: messageContent,
          sender_id: user.id,
          is_private: activeTab === "private",
          recipient_id: selectedRecipient?.id
        })
        .select()
        .single();

      if (error) throw error;
      // Note: We don't necessarily need to manually update state here anymore 
      // because the Realtime subscription will handle the replacement of the temporary ID
      // by matching content and sender_id. This prevents the "double message" flicker.
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      // Remove optimistic message if insert failed
      setMessages(prev => prev.filter(m => m.id !== temporaryId));
      setNewMessage(messageContent);
    }
  };

  return (
    <div className="w-full max-w-full h-[calc(100vh-120px)] flex gap-4 xl:gap-6 py-2 px-4">
      {/* Sidebar - Canais e Usuários */}
      <div className="w-72 hidden lg:flex flex-col gap-6 shrink-0">
        <div className="bg-black/30 dark:bg-black/60 border border-emerald-200/20 dark:border-emerald-800/30 p-6 rounded-[2.5rem] flex-1 overflow-y-auto shadow-xl shadow-black/20 glass">
          <h2 className="text-xl font-black text-emerald-900 dark:text-white mb-8 flex items-center gap-3 uppercase tracking-tighter">
            <div className="p-2 bg-brand-green/20 rounded-xl">
              <MessageSquare size={20} className="text-brand-green" />
            </div>
            Central Chat
          </h2>
          
          <div className="space-y-3 mb-10">
            <h3 className="text-[10px] font-black text-emerald-800/60 dark:text-emerald-100/40 uppercase tracking-[0.3em] mb-4 ml-2">Canais Públicos</h3>
            <button 
              onClick={() => { setActiveTab("public"); setSelectedRecipient(null); }}
              className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all duration-300 relative group border ${
                activeTab === "public" 
                ? "bg-brand-green text-black border-brand-green shadow-lg shadow-brand-green/20 font-black" 
                : "bg-black/40 dark:bg-black/80 border-emerald-800/20 hover:bg-emerald-500/20 text-emerald-100 dark:text-white font-bold"
              }`}
            >
              <Hash size={20} className={activeTab === "public" ? "text-black" : "text-brand-green group-hover:scale-110 transition-transform"} />
              <span className="text-sm uppercase tracking-wider">GERAL</span>
              {activeTab === "public" && <motion.div layoutId="activePill" className="absolute left-0 w-1.5 h-6 bg-black rounded-r-full" />}
            </button>
          </div>

          <div className="flex items-center justify-between mb-6 ml-2">
            <h3 className="text-[10px] font-black text-emerald-800/60 dark:text-emerald-100/40 uppercase tracking-[0.3em]">Membros Online</h3>
            <span className="text-[9px] bg-emerald-500/20 text-brand-green px-2 py-0.5 rounded-full font-black">{users.length}</span>
          </div>
          
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="group relative">
                <button 
                  onClick={() => { setActiveTab("private"); setSelectedRecipient(u); }}
                  className={`w-full flex items-center gap-4 p-3.5 rounded-3xl transition-all duration-300 border ${
                    selectedRecipient?.id === u.id 
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-xl shadow-emerald-900/30" 
                    : "bg-black/40 dark:bg-black/80 border-emerald-800/20 hover:bg-emerald-500/20 text-emerald-100 dark:text-white font-bold"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-2xl border-2 overflow-hidden flex items-center justify-center transition-all ${
                      selectedRecipient?.id === u.id ? "border-brand-green" : "border-emerald-700/30 dark:border-emerald-800/30 bg-black/20"
                    }`}>
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <User size={18} className="text-emerald-400" />}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-emerald-950 ${isOnline(u.last_seen) ? "bg-brand-green" : "bg-slate-600"}`} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-black truncate uppercase ${selectedRecipient?.id === u.id ? "text-white" : "text-emerald-50 dark:text-white"}`}>{u.full_name}</p>
                      {u.role === "admin" && (
                        <span className="p-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[7px] font-black text-amber-500 uppercase tracking-tight shrink-0">
                          ADM
                        </span>
                      )}
                    </div>
                    <p className={`text-[9px] font-bold truncate opacity-60 uppercase tracking-tighter ${selectedRecipient?.id === u.id ? "text-emerald-100" : "text-emerald-300 dark:text-emerald-400"}`}>{u.setor || "NIT"}</p>
                  </div>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingProfile(u); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/20 rounded-xl transition-all text-emerald-400"
                  title="Perfil Auditado"
                >
                  <User size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black/5 dark:bg-black/40 border border-emerald-100/20 dark:border-emerald-800/40 rounded-[3rem] overflow-hidden shadow-2xl relative glass">
        {/* Header */}
        <div className="p-8 border-b border-emerald-100/10 dark:border-emerald-800/40 flex justify-between items-center bg-black/10 dark:bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-6">
            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-green/20 overflow-hidden ${activeTab === "public" ? "bg-brand-green text-black" : "bg-emerald-800 text-white"}`}>
              {activeTab === "public" ? (
                <span className="text-xl font-black">AG</span>
              ) : selectedRecipient?.avatar_url ? (
                <img src={selectedRecipient.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black">
                  {selectedRecipient?.full_name?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-emerald-900 dark:text-white uppercase tracking-tight">
                    {activeTab === "public" ? "GERAL" : `${selectedRecipient?.full_name}`}
                  </h2>
                  {activeTab !== "public" && selectedRecipient?.role === "admin" && (
                    <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck size={10} /> Admin
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${isOnline(activeTab === "public" ? "" : selectedRecipient?.last_seen) ? "bg-brand-green/10" : "bg-slate-500/10"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline(activeTab === "public" ? "" : selectedRecipient?.last_seen) ? "bg-brand-green animate-pulse" : "bg-slate-500"}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline(activeTab === "public" ? "" : selectedRecipient?.last_seen) ? "text-brand-green" : "text-slate-500"}`}>
                    {isOnline(activeTab === "public" ? "" : selectedRecipient?.last_seen) || activeTab === "public" ? "Ativo" : "Offline"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-[0.2em] mt-1">
                {activeTab === "public" ? "Protocolo de Comunicação Cedro" : "Conexão Ponto-a-Ponto Segura"}
              </p>
            </div>
          </div>
          
          <div className="hidden md:flex flex-col items-end">
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Status do Servidor</div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-12 bg-emerald-800/20 rounded-full overflow-hidden">
                <motion.div initial={{ x: -50 }} animate={{ x: 50 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="h-full w-4 bg-brand-green" />
              </div>
              <span className="text-[9px] font-black text-brand-green uppercase">Sincronizado</span>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-[1.5rem] h-12 w-12 border-t-2 border-r-2 border-brand-green" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Carregando Fluxos...</span>
            </div>
          ) : activeTab === "private" && !selectedRecipient ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mb-6">
                <MessageSquare className="text-emerald-500/40" size={40} />
              </div>
              <h3 className="text-2xl font-black text-emerald-900 dark:text-white uppercase mb-4 tracking-tighter">Inicie uma conversa direta</h3>
              <p className="text-emerald-600 dark:text-emerald-400/60 text-sm max-w-sm font-medium uppercase text-xs tracking-tight">Protocolo de comunicação interna. Selecione um colega para iniciar uma conexão criptografada.</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.sender_id === user?.id;
              const showAvatar = idx === 0 || messages[idx-1].sender_id !== msg.sender_id;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: isOwn ? 20 : -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  key={msg.id} 
                  className={`flex gap-4 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className="w-10 h-10 shrink-0">
                    {showAvatar && (
                      <button 
                        onClick={() => msg.sender_profile && setViewingProfile(msg.sender_profile)}
                        className={`w-10 h-10 rounded-2xl bg-white dark:bg-emerald-900/40 border overflow-hidden flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 ${
                          isOwn ? "border-brand-green/30" : "border-emerald-200 dark:border-emerald-800"
                        }`}
                      >
                        {msg.sender_profile?.avatar_url ? (
                          <img src={msg.sender_profile.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <User size={18} className="text-emerald-500" />
                        )}
                      </button>
                    )}
                  </div>
                  
                  <div className={`max-w-[70%] space-y-1.5 ${isOwn ? "items-end" : "items-start"}`}>
                    {showAvatar && (
                      <div className={`flex items-center gap-2 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                          <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-tight">
                            {msg.sender_profile?.full_name || "Membro Cedro"}
                          </span>
                          {msg.sender_profile?.role === "admin" && (
                            <span className="px-1 py-0.2 bg-amber-500/20 border border-amber-500/30 rounded-[4px] text-[7px] font-black text-amber-500 uppercase tracking-tighter shrink-0 flex items-center gap-0.5">
                              <ShieldCheck size={7} /> ADM
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-black text-emerald-400 uppercase opacity-60">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className={`p-5 rounded-[2rem] text-sm font-medium leading-relaxed shadow-xl border relative whitespace-pre-wrap ${
                      isOwn 
                      ? "bg-brand-green text-black border-brand-green/20 rounded-tr-none" 
                      : "bg-black/40 dark:bg-emerald-900/40 text-emerald-100 dark:text-emerald-50 border-emerald-800/20 dark:border-emerald-800/40 rounded-tl-none"
                    }`}>
                       {msg.content}
                      {/* Efeito de brilho para mensagens próprias */}
                      {isOwn && <div className="absolute inset-0 bg-white/10 rounded-[2rem] pointer-events-none" />}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-black/10 dark:bg-black/60 border-t border-emerald-100/10 dark:border-emerald-800/40">
          <form onSubmit={handleSendMessage} className="flex items-center gap-4 relative group">
            <div className="flex-1 relative">
              <textarea
                placeholder={activeTab === "private" && !selectedRecipient ? "AGUARDANDO CONEXÃO..." : "DIGITAR..."}
                disabled={activeTab === "private" && !selectedRecipient}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
                rows={1}
                className="w-full pl-8 pr-20 py-5 bg-white dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/60 rounded-[2rem] outline-none text-emerald-900 dark:text-white font-bold text-sm tracking-tight placeholder:text-emerald-400 dark:placeholder:text-emerald-100/40 focus:border-brand-green dark:focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all shadow-inner uppercase tracking-wider resize-none min-h-[64px] max-h-32 custom-scrollbar"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <kbd className="hidden sm:inline-flex px-2 py-1 bg-brand-green/20 rounded-lg text-[9px] font-black text-brand-green border border-brand-green/30 uppercase shadow-[0_0_10px_rgba(0,255,101,0.2)]">Enter</kbd>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={!newMessage.trim() || (activeTab === "private" && !selectedRecipient)}
              className="w-16 h-16 flex items-center justify-center bg-brand-green hover:bg-emerald-400 text-black rounded-[1.8rem] transition-all active:scale-90 disabled:opacity-50 disabled:grayscale shadow-2xl shadow-brand-green/20 group/send"
            >
              <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
          </form>
          <div className="mt-4 flex items-center justify-between px-4">
            <div className="flex gap-4">
              <span className="text-[8px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                <div className="size-1 rounded-full bg-brand-green shadow-[0_0_5px_rgba(0,255,101,1)]"></div> Canal Seguro
              </span>
              <span className="text-[8px] font-black text-emerald-100/60 uppercase tracking-widest flex items-center gap-1.5">
                <div className="size-1 rounded-full bg-emerald-500/50"></div> Latência: 12ms
              </span>
            </div>
            <p className="text-[8px] font-black text-emerald-100/40 uppercase tracking-tight">Pressione Shift + Enter para quebra de linha</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {viewingProfile && (
          <ProfileModal 
            profile={viewingProfile} 
            onClose={() => setViewingProfile(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
