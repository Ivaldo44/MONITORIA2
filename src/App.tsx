/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { LayoutDashboard, ClipboardList, PlusCircle, FileText, Menu, X, ChevronRight, Activity, ShieldAlert, CheckCircle2, AlertTriangle, Users, Database, MessageSquare, UserCircle, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, StatusUso, UserProfile, StatusAuditoria, ApprovalWorkflow, ApprovalConfig } from "./types";
import { getRecords, deleteRecord, addRecord, updateRecord, checkSupabaseStatus, saveRecordsToSupabase, getProfiles, updateUserProfile } from "./storage";
import { supabase } from "./lib/supabase";
import Dashboard from "./components/Dashboard";
import Inventory from "./components/Inventory";
import SectorMap from "./components/SectorMap";
import AdminPanel from "./components/AdminPanel";
import SectorsManager from "./components/SectorsManager";
import RegistrationForm from "./components/RegistrationForm";
import ReportView from "./components/ReportView";
import LabBackground from "./components/LabBackground";
import { Auth } from "./components/Auth";
import { UserProfileView } from "./components/UserProfileView";
import { Chat } from "./components/Chat";
import { useAuth } from "./contexts/AuthContext";

export interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "chat";
  actionLabel?: string;
  onAction?: () => void;
}

function playNotificationSound(type: "chat" | "success" | "info" | "warning") {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === "chat") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.3);
    } else if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      gain3.gain.setValueAtTime(0.1, ctx.currentTime + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.35);
      osc3.start(ctx.currentTime + 0.3);
      osc3.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Erro ao reproduzir som de notificação:", e);
  }
}

export default function App() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const isCurrentUserAdmin = profile?.role?.toLowerCase().trim() === "admin";
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "new" | "report" | "profile" | "chat" | "sectors" | "admin" | "sectors_mgr">("profile"); // sempre inicia no perfil após login
  const [records, setRecords] = useState<IARecord[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>({
    steps: [
      { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false },
      { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false },
      { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false },
      { stepNumber: 4, roleName: "Análise Financeira", isOpinionOnly: true },
      { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false },
    ]
  });
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<"online" | "offline" | "checking">("checking");
  const [selectedRecord, setSelectedRecord] = useState<IARecord | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isDarkMode = false; // Modo escuro removido - apenas modo claro

  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const addToast = (toast: Omit<NotificationToast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { ...toast, id }]);
    playNotificationSound(toast.type);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Dark mode removido - garantir que a classe dark nunca seja aplicada
  useEffect(() => { document.documentElement.classList.remove("dark"); }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  const loadApprovalData = async () => {
    try {
      const { data: configData } = await supabase.from("approval_config").select("*").order("step_number");
      if (configData && configData.length > 0) {
        setApprovalConfig({
          steps: configData.map((c: any) => ({
            stepNumber: c.step_number,
            roleName: c.role_name,
            userId: c.assigned_user_id,
            userName: c.assigned_user_name,
            isOpinionOnly: c.is_opinion_only,
          }))
        });
      }
      const { data: wfData } = await supabase.from("approval_workflows").select(`*, steps:approval_steps(*)`);
      if (wfData) {
        setWorkflows(wfData.map((wf: any) => ({
          iaRecordId: wf.ia_record_id,
          currentStep: wf.current_step,
          finalStatus: wf.final_status,
          completedAt: wf.completed_at,
          steps: (wf.steps || []).map((s: any) => ({
            stepNumber: s.step_number,
            roleName: s.role_name,
            assignedUserId: s.assigned_user_id,
            assignedUserName: s.assigned_user_name,
            status: s.status,
            comment: s.comment,
            decidedAt: s.decided_at,
            isOpinionOnly: s.is_opinion_only,
          }))
        })));
      }
    } catch (e) {
      console.error("Erro ao carregar dados de aprovação:", e);
    }
  };

  const refreshRecords = async () => {
    setIsSyncing(true);
    try {
      const isOnline = await checkSupabaseStatus();
      setSupabaseStatus(isOnline ? "online" : "offline");
      
      const isAdmin = profile?.role?.toLowerCase().trim() === "admin";
      const data = await getRecords(user?.id, isAdmin, profile?.setor);
      setRecords(data);
      
      // Sempre buscar perfis para que o chat e outros componentes tenham os dados correspondentes
      const usersData = await getProfiles();
      if (isAdmin) {
        setProfiles(usersData);
      } else {
        const userSector = profile?.setor?.toLowerCase().trim();
        const filteredUsers = usersData.filter(p => {
          const isUserAdmin = p.role?.toLowerCase().trim() === "admin";
          const isSameSector = p.setor && userSector && p.setor.toLowerCase().trim() === userSector;
          return isUserAdmin || isSameSector;
        });
        setProfiles(filteredUsers);
      }
    } catch (error) {
      console.error("Erro ao atualizar registros:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (user && profile) refreshRecords();

    // Heartbeat for last_seen status
    let interval: any;
    if (user && profile) {
      const updatePresence = async () => {
        try {
          await updateUserProfile(user.id, { last_seen: new Date().toISOString() });
        } catch (e) {
          console.warn("Falha no heartbeat de presença:", e);
        }
      };
      
      updatePresence(); // Initial call
      interval = setInterval(updatePresence, 60000); // Every 1 minute
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, profile]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const isOnline = await checkSupabaseStatus();
      setSupabaseStatus(isOnline ? "online" : "offline");
    }, 30000); // Check every 30s
    
    return () => clearInterval(interval);
  }, []);

  // Refs to always keep current values inside real-time event listeners
  const activeTabRef = React.useRef(activeTab);
  const profileRef = React.useRef(profile);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    console.log("🔔 Iniciando escutadores em tempo real para notificações...");

    // 1. Escutador de novas mensagens no chat
    const messageChannel = supabase
      .channel("global-chat-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === user.id) return;

          const currentTab = activeTabRef.current;
          let shouldNotify = false;

          if (currentTab !== "chat") {
            // Se não está no chat, notifica sobre mensagens públicas ou privadas direcionadas para si
            if (!msg.is_private) {
              shouldNotify = true;
            } else if (msg.recipient_id === user.id) {
              shouldNotify = true;
            }
          } else {
            // Se está na tela do chat, notifica apenas se for mensagem privada direcionada e o remetente não for o chat ativo atual
            if (msg.is_private && msg.recipient_id === user.id) {
              const activeChatWith = localStorage.getItem("active_chat_with");
              if (activeChatWith !== msg.sender_id) {
                shouldNotify = true;
              }
            }
          }

          if (shouldNotify) {
            try {
              const { data: senderProf } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", msg.sender_id)
                .single();

              const senderName = senderProf?.full_name || "Colega";
              addToast({
                title: `Chat: ${senderName}`,
                message: msg.content.length > 60 ? `${msg.content.slice(0, 60)}...` : msg.content,
                type: "chat",
                actionLabel: "Ver Mensagem",
                onAction: () => {
                  setActiveTab("chat");
                }
              });
            } catch (err) {
              console.error("Erro ao buscar remetente:", err);
            }
          }
        }
      )
      .subscribe();

    // 2. Escutador de avaliações de IA de interesse
    const recordChannel = supabase
      .channel("global-records-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ia_records" },
        async (payload) => {
          const recordRaw = payload.new as any;
          if (!recordRaw || !recordRaw.data) return;

          const updatedRec = recordRaw.data as IARecord;
          updatedRec.id = recordRaw.id; // Garante ID correto

          setRecords(prevRecords => {
            const oldRec = prevRecords.find(r => r.id === updatedRec.id);
            if (oldRec) {
              const statusAuditoriaChanged = oldRec.statusAuditoria !== updatedRec.statusAuditoria;
              const statusUsoChanged = oldRec.statusUso !== updatedRec.statusUso;

              if (statusAuditoriaChanged || statusUsoChanged) {
                const currentProfile = profileRef.current;
                
                // Notificar se a IA editada pertence ao mesmo setor do usuário
                const isRelevantForMe = 
                  updatedRec.unidadeSetor?.toLowerCase().trim() === currentProfile?.setor?.toLowerCase().trim();

                const isUpdatedByMe = currentProfile?.role?.toLowerCase().trim() === "admin" && 
                  (activeTabRef.current === "admin" || activeTabRef.current === "sectors");

                if (isRelevantForMe && !isUpdatedByMe) {
                  let text = "";
                  if (statusAuditoriaChanged && statusUsoChanged) {
                    text = `Auditoria: "${updatedRec.statusAuditoria}" e Uso: "${updatedRec.statusUso}".`;
                  } else if (statusAuditoriaChanged) {
                    text = `Auditoria atualizada para "${updatedRec.statusAuditoria}".`;
                  } else {
                    text = `Status de uso atualizado para "${updatedRec.statusUso}".`;
                  }

                  setTimeout(() => {
                    addToast({
                      title: `IA Avaliada: ${updatedRec.nomeFerramenta}`,
                      message: text,
                      type: updatedRec.statusAuditoria === StatusAuditoria.APROVADO ? "success" : "info",
                      actionLabel: "Analisar",
                      onAction: () => {
                        setSelectedRecord(updatedRec);
                        setActiveTab("report");
                      }
                    });
                  }, 50);
                }
              }
              return prevRecords.map(r => r.id === updatedRec.id ? updatedRec : r);
            }
            return prevRecords;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(recordChannel);
    };
  }, [user]);

  const handleSync = async () => {
    if (supabaseStatus !== "online") {
      alert("Supabase está offline. Verifique suas chaves de API.");
      return;
    }
    
    setIsSyncing(true);
    try {
      console.log("Forçando sincronização manual...");
      const isAdmin = isCurrentUserAdmin;
      await saveRecordsToSupabase(records, user?.id, isAdmin);
      await refreshRecords();
      alert("✅ Sincronização concluída com sucesso!");
    } catch (error: any) {
      console.error("Erro na sincronização manual:", error);
      alert(`❌ Erro na sincronização: ${error.message || "Erro desconhecido"}. Verifique o SQL do Supabase.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = (record: IARecord) => {
    setSelectedRecord(record);
    setActiveTab("new");
  };

  const handleView = (record: IARecord) => {
    setSelectedRecord(record);
    setActiveTab("report");
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    const previousRecords = [...records];
    setRecords(prev => prev.filter(r => r.id !== id));
    
    try {
      await deleteRecord(id);
      await refreshRecords();
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setRecords(previousRecords);
      alert("Houve um erro ao excluir o registro. Por favor, tente novamente.");
      await refreshRecords();
    }
  };

  const handleSave = async (record: IARecord) => {
    const isNew = !records.find(r => r.id === record.id);
    const isAdmin = isCurrentUserAdmin;
    
    try {
      if (isNew) {
        await addRecord(record, user?.id, isAdmin);
        // Criar workflow de aprovação automaticamente
        try {
          const { data: wfData } = await supabase.from("approval_workflows").insert({
            ia_record_id: record.id,
            current_step: 1,
            final_status: "pendente",
          }).select().single();

          if (wfData) {
            const stepsToInsert = approvalConfig.steps.map(step => ({
              workflow_id: wfData.id,
              ia_record_id: record.id,
              step_number: step.stepNumber,
              role_name: step.roleName,
              assigned_user_id: step.userId || null,
              assigned_user_name: step.userName || null,
              status: "aguardando",
              is_opinion_only: step.isOpinionOnly || false,
            }));
            await supabase.from("approval_steps").insert(stepsToInsert);
          }
        } catch (wfErr) {
          console.error("Erro ao criar workflow:", wfErr);
        }
      } else {
        await updateRecord(record, user?.id, isAdmin);
      }
      await refreshRecords();
      await loadApprovalData();
      setActiveTab("inventory");
      setSelectedRecord(null);
    } catch (error: any) {
      console.error("Erro ao salvar registro:", error);
      alert(`⚠️ Erro ao salvar: ${error.message || "Erro desconhecido"}. Verifique o console ou a estrutura do banco.`);
    }
  };

  const handleSaveApprovalConfig = async (config: ApprovalConfig) => {
    try {
      for (const step of config.steps) {
        await supabase.from("approval_config").upsert({
          step_number: step.stepNumber,
          role_name: step.roleName,
          assigned_user_id: step.userId || null,
          assigned_user_name: step.userName || null,
          is_opinion_only: step.isOpinionOnly || false,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        }, { onConflict: "step_number" });
      }
      setApprovalConfig(config);
    } catch (e) {
      console.error("Erro ao salvar config de aprovação:", e);
    }
  };

  const handleUpdateStatus = async (recordId: string, status: any, comment?: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    const isAdmin = isCurrentUserAdmin;
    const historyEntry = {
      date: new Date().toISOString(),
      user: profile?.full_name || "Admin",
      action: status === StatusAuditoria.APROVADO ? "Aprovação Técnica" : status === StatusAuditoria.NEGADO ? "Reprovação/Bloqueio" : "Reversão de Status",
      message: comment || `Status de auditoria atualizado para ${status}`
    };

    // Keep statusUso in sync with statusAuditoria so it updates the Status view for users
    const newStatusUso = status === StatusAuditoria.APROVADO 
      ? StatusUso.APROVADO 
      : status === StatusAuditoria.NEGADO 
      ? StatusUso.NAO_APROVADO 
      : StatusUso.EM_AVALIACAO;

    const updatedRecord = { 
      ...record, 
      statusAuditoria: status,
      statusUso: newStatusUso,
      historico: [historyEntry, ...(record.historico || [])]
    };
    
    // Optimistic update
    setRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));
    
    try {
      await updateRecord(updatedRecord, user?.id, isAdmin);
      await refreshRecords();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar o status da auditoria.");
      await refreshRecords();
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: "admin" | "user") => {
    // Check if it's a real GUID/UUID (Fallback names are not UUIDs)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    if (!isUuid) {
      alert(`⚠️ Não foi possível atualizar: Este usuário ainda não possui uma conta de acesso ao sistema (perfil incompleto). Apenas usuários que já fizeram login pelo menos uma vez podem ser tornados administradores.`);
      return;
    }

    // Guard against self-demotion to avoid losing access to admin panel accidentally
    if (userId === user?.id && newRole === "user") {
      const confirmSelf = window.confirm("⚠️ Você está prestes a remover seus próprios privilégios de administrador. Você perderá acesso a este painel. Deseja continuar?");
      if (!confirmSelf) return;
    }

    // Optimistic update
    const previousProfiles = [...profiles];
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));

    try {
      console.log(`🚀 Solicitando alteração de cargo para usuário ${userId} para: ${newRole}`);
      
      // Get the session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId, newRole })
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Erro do servidor (${response.status}): O servidor não retornou JSON. Verifique se as rotas de API estão configuradas.`);
      }

      if (!response.ok) {
        throw new Error(result.error || "Falha na comunicação com o servidor");
      }
      
      if (result.success && result.profile) {
        console.log(`✅ Alteração persistida via API para ${userId}`);
        setProfiles(prev => prev.map(p => p.id === userId ? result.profile : p));
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }
      
      // Full refresh to ensure consistency across all data
      if (userId === user?.id) {
        await refreshProfile();
      }
      await refreshRecords();
      alert(`✅ Sucesso! O usuário agora tem acesso de ${newRole === "admin" ? "ADMINISTRADOR" : "USUÁRIO COMUM"}.`);
    } catch (error: any) {
      console.error("❌ Erro fatal ao atualizar role do usuário:", error);
      // Rollback
      setProfiles(previousProfiles);
      alert(`Erro: ${error.message || "Erro desconhecido ao atualizar permissões"}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        await response.text(); // consume body anyway
        throw new Error(`Erro do servidor (${response.status}). Verifique se as rotas de API do backend estão ativas no ambiente de produção.`);
      }

      if (!response.ok) {
        throw new Error(result.error || "Falha ao apagar usuário");
      }

      setProfiles(prev => prev.filter(p => p.id !== userId));
      alert("✅ Usuário apagado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao apagar usuário:", error);
      alert(`⚠️ Erro ao apagar: ${error.message}`);
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventário de IA", icon: ClipboardList },
    { id: "sectors", label: "Mapa de IAs", icon: Users, adminOnly: true },
    { id: "sectors_mgr", label: "Setores", icon: Building2, adminOnly: true },
    { id: "admin", label: "Gestão Admin", icon: ShieldAlert, adminOnly: true },
    { id: "new", label: "Novo Cadastro", icon: PlusCircle },
    { id: "report", label: "Relatórios", icon: FileText },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "profile", label: "Meu Perfil", icon: UserCircle },
  ].filter(item => !item.adminOnly || isCurrentUserAdmin);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lab-cyan"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <Auth />
      </div>
    );
  }

  return (
      <div className={`min-h-screen flex flex-col md:flex-row font-sans selection:bg-brand-green selection:text-black transition-colors duration-300 bg-[var(--bg-main)] ${isDarkMode ? "dark" : ""}`}>
      <LabBackground />
      {/* Mobile Header */}
      <div className="md:hidden bg-[var(--bg-sidebar)] backdrop-blur-md p-4 flex justify-between items-center border-b border-[var(--border-lab)] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" alt="Cedro IA Logo" className="h-10 w-auto [filter:var(--logo-filter)]" />
        </div>
        <div className="flex items-center gap-2">

          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation - AI Laboratory Control Panel Style */}
      <aside 
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } fixed md:static inset-y-0 left-0 z-40 w-72 bg-[var(--bg-sidebar)] border-r border-[var(--border-lab)] transition-transform duration-300 ease-in-out md:flex flex-col shrink-0 overflow-hidden shadow-xl shadow-black/5 dark:shadow-black/50`}
      >
        <div className="p-8 hidden md:block border-b border-[var(--border-lab)] bg-gradient-to-b from-brand-green/10 to-transparent">
          <div className="flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-brand-green/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <img src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" alt="Cedro IA Logo" className="h-16 w-auto [filter:var(--logo-filter)] relative z-10" />
          </div>
        </div>

        <nav className="mt-8 flex-1 px-4 space-y-2">
          <div className="text-xs font-black uppercase tracking-[0.05em] mb-4 px-4 text-[var(--text-muted)]">Navegação Principal</div>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "new") setSelectedRecord(null);
                setActiveTab(item.id as any);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 relative overflow-hidden ${
                activeTab === item.id 
                  ? "bg-brand-green/10 text-brand-green" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-brand-green"
                />
              )}
              <item.icon size={20} className={`${
                activeTab === item.id ? "text-brand-green" : "text-slate-600 group-hover:text-slate-400"
              }`} />
              <span className="tracking-tight">{item.label}</span>
              {activeTab === item.id && (
                <div className="ml-auto flex items-center gap-1">
                  <div className="size-1 rounded-full bg-brand-green animate-pulse"></div>
                  <div className="size-1 rounded-full bg-brand-green/40"></div>
                </div>
              )}
            </button>
          ))}
        </nav>


      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-[var(--bg-main)]/60 backdrop-blur-md border-b border-[var(--border-lab)] px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-brand-green/5 border border-brand-green/20 rounded-full">
              <div className="size-1.5 rounded-full bg-brand-green"></div>
              <span className="text-[11px] font-bold text-brand-green uppercase tracking-wide">Status: Online</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-bright)] flex items-center gap-3">
              <span className="text-brand-green/40 opacity-50 font-mono text-sm leading-none tabular-nums">/0{menuItems.findIndex(m => m.id === activeTab) + 1}</span>
              {menuItems.find(m => m.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-3 mr-4">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {isCurrentUserAdmin && (
                      <span className="text-[9px] font-black bg-brand-green/20 text-brand-green px-1.5 py-0.5 rounded border border-brand-green/30">ADMIN</span>
                    )}
                    <p className="text-[11px] font-bold text-[var(--text-bright)] leading-tight">{profile?.full_name || "Usuário"}</p>
                  </div>
                  <p className="text-[9px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{profile?.cargo || "Colaborador"}</p>
                </div>
                <button 
                  onClick={() => setActiveTab("profile")}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-green to-lab-cyan p-0.5"
                >
                  <div className="w-full h-full rounded-[10px] bg-[var(--bg-card)] overflow-hidden flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle size={20} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                </button>
             </div>

             <div className="hidden sm:flex items-center gap-8 px-5 py-2 glass rounded-2xl">
               <div className="flex flex-col items-end">
                 <div className="flex items-center gap-1.5">
                   <ShieldAlert size={12} className="text-lab-cyan" />
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Privacidade LGPD</span>
                 </div>
                 <span className="text-[11px] font-black text-lab-cyan">ATIVO</span>
               </div>
               <div className="h-8 w-px bg-[var(--border-lab)]"></div>
               <div className="flex flex-col items-end">
                 <div className="flex items-center gap-1.5">
                   <Activity size={12} className="text-brand-green" />
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saúde do Sistema</span>
                 </div>
                 <span className="text-[11px] font-black text-brand-green">OTIMIZADO</span>
               </div>
               <div className="h-8 w-px bg-[var(--border-lab)]"></div>
               <div className="flex flex-col items-end group relative">
                 <div className="flex items-center gap-1.5">
                   <Database size={12} className={supabaseStatus === "online" ? "text-brand-green" : "text-brand-orange"} />
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nuvem</span>
                 </div>
                 <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={`text-[11px] font-black flex items-center gap-1 hover:underline decoration-dotted ${
                    supabaseStatus === "online" ? "text-brand-green" : supabaseStatus === "offline" ? "text-brand-orange" : "text-slate-400"
                  }`}
                 >
                   {isSyncing ? "SINCRONIZANDO..." : supabaseStatus === "online" ? "ATIVO (SICRONIZAR)" : supabaseStatus === "offline" ? "OFFLINE" : "VERIFICANDO..."}
                   {isSyncing && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="size-2 border-t-2 border-brand-green rounded-full" />}
                 </button>
               </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8 custom-scrollbar bg-[var(--bg-content)]">

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-[90rem] mx-auto bg-[var(--bg-card-page)] border-4 border-[var(--border-page)] rounded-[3rem] p-6 md:p-10 shadow-2xl relative text-[var(--text-bright)]"
            >
              {activeTab === "dashboard" && (
                <Dashboard records={records} onNavigate={(tab) => setActiveTab(tab)} isAdmin={isCurrentUserAdmin} />
              )}
              {activeTab === "inventory" && (
                <Inventory 
                  records={records} 
                  onEdit={handleEdit} 
                  onView={handleView} 
                  onDelete={handleDelete}
                  onAdd={() => {
                    setSelectedRecord(null);
                    setActiveTab("new");
                  }}
                  onRefresh={refreshRecords} approvalConfig={approvalConfig} onSaveApprovalConfig={handleSaveApprovalConfig}
                  isAdmin={isCurrentUserAdmin}
                />
              )}
              {activeTab === "sectors" && isCurrentUserAdmin && (
                <SectorMap records={records} profiles={profiles} />
              )}
              {activeTab === "sectors_mgr" && isCurrentUserAdmin && (
                <SectorsManager records={records} profiles={profiles} onRefresh={refreshRecords} approvalConfig={approvalConfig} onSaveApprovalConfig={handleSaveApprovalConfig} />
              )}
              {activeTab === "admin" && isCurrentUserAdmin && (
                <AdminPanel 
                  records={records} 
                  profiles={profiles}
                  onUpdateStatus={handleUpdateStatus} 
                  onViewRecord={handleView} 
                  onUpdateUserRole={handleUpdateUserRole}
                  onDeleteUser={handleDeleteUser}
                />
              )}
              {activeTab === "chat" && (
                <Chat />
              )}
              {activeTab === "profile" && (
                <UserProfileView />
              )}
              {activeTab === "new" && (
                <RegistrationForm 
                  initialData={selectedRecord} 
                  onSave={handleSave} 
                  onCancel={() => setActiveTab("inventory")} 
                  isAdmin={isCurrentUserAdmin}
                />
              )}
              {activeTab === "report" && (
                selectedRecord ? (
                  <ReportView 
                    record={selectedRecord} 
                    onBack={() => {
                      setSelectedRecord(null);
                      setActiveTab("report");
                    }} 
                  />
                ) : (
                  <div className="space-y-8 pb-20">
                    <div className="glass p-12 rounded-[2.5rem] border border-[var(--border-lab)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-lab-blue/5 blur-3xl rounded-full pointer-events-none"></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {records.map(record => (
                            <button
                              key={record.id}
                              onClick={() => setSelectedRecord(record)}
                              className="group flex flex-col p-6 bg-white/[0.02] border border-brand-green/20 rounded-3xl hover:bg-black/5 dark:hover:bg-white/5 hover:border-brand-green/50 transition-all text-left relative overflow-hidden shadow-lg shadow-brand-green/5"
                            >
                            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-lab-cyan/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                            <div className="flex justify-between items-start mb-6">
                              <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-brand-green bg-brand-green/20 px-2 py-1 rounded border border-brand-green/40 uppercase tracking-tight">{record.id}</span>
                              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-500 group-hover:text-lab-cyan group-hover:bg-lab-cyan/10 transition-all border border-transparent group-hover:border-lab-cyan/20">
                                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                            <h4 className="font-bold text-[var(--text-bright)] text-lg tracking-tight mb-1 group-hover:text-lab-cyan transition-colors uppercase truncate">{record.nomeFerramenta}</h4>
                            <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-tight truncate w-full flex items-center gap-2">
                              <Users size={12} className="opacity-50" /> {record.unidadeSetor}
                            </p>
                            
                            <div className="mt-8 pt-6 border-t border-[var(--border-lab)] flex justify-between items-center">
                              <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase flex items-center gap-1.5 ${
                                record.statusUso === StatusUso.APROVADO 
                                  ? "bg-brand-green/10 text-brand-green border-brand-green/20" 
                                  : "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
                              }`}>
                                <div className={`size-1.5 rounded-full ${record.statusUso === StatusUso.APROVADO ? "bg-brand-green" : "bg-brand-orange"}`}></div>
                                {record.statusUso}
                              </div>
                              <span className="text-[10px] font-mono text-[var(--text-muted)]">{record.dataRegistro}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {records.length === 0 && (
                        <div className="py-32 text-center space-y-6">
                          <div className="inline-block p-6 bg-black/5 dark:bg-white/[0.02] rounded-full border border-[var(--border-lab)] relative">
                            <div className="absolute inset-0 bg-brand-green/5 blur-xl rounded-full"></div>
                            <ClipboardList className="text-[var(--text-muted)] relative z-10" size={40} />
                          </div>
                          <div className="space-y-2">
                            <p className="text-[var(--text-muted)] font-bold text-base uppercase tracking-wide">Nenhum dado encontrado para auditoria</p>
                            <p className="text-sm text-[var(--text-muted)]">Aguardando novos registros para gerar relatórios de conformidade.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {/* Removed redundant delete modal as it's handled by components */}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-[360px] pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, x: 50 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="pointer-events-auto bg-slate-900/90 dark:bg-emerald-950/95 backdrop-blur-md rounded-2xl border border-emerald-800/50 p-4 shadow-2xl flex gap-3 relative overflow-hidden"
              style={{ boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)" }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-green to-lab-cyan" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h4 className="font-bold text-white text-sm tracking-tight truncate uppercase pr-4">
                    {toast.title}
                  </h4>
                  <button 
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors -mr-1 -mt-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-slate-300 dark:text-emerald-100 text-xs line-clamp-3 leading-relaxed mb-3 pr-2">
                  {toast.message}
                </p>
                
                {toast.actionLabel && toast.onAction && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        toast.onAction?.();
                        removeToast(toast.id);
                      }}
                      className="text-[10px] font-black uppercase text-brand-green bg-brand-green/10 hover:bg-brand-green hover:text-black py-1 px-3 rounded-full transition-all tracking-[0.05em] border border-brand-green/20"
                    >
                      {toast.actionLabel}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
