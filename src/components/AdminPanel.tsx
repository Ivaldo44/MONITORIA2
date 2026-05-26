import React, { useState, useMemo } from "react";
import { 
  CheckCircle2, XCircle, Users, LayoutGrid, Search, 
  Filter, MoreHorizontal, ShieldCheck, ShieldAlert, ShieldX, 
  Database, ArrowUpRight, TrendingUp, AlertTriangle, Activity,
  ChevronLeft, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, StatusAuditoria, StatusUso, UserProfile, ApprovalConfig } from "../types";

interface AdminPanelProps {
  records: IARecord[];
  profiles: UserProfile[];
  onUpdateStatus: (recordId: string, status: StatusAuditoria, comment?: string) => void;
  onViewRecord: (record: IARecord) => void;
  onUpdateUserRole?: (userId: string, newRole: "admin" | "user") => void;
  onDeleteUser?: (userId: string) => void;
}

type AdminTab = "approvals" | "sectors" | "users" | "workflow";

export default function AdminPanel({ 
  records, 
  profiles, 
  onUpdateStatus, 
  onViewRecord, 
  onUpdateUserRole,
  onDeleteUser
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("approvals");
  const [workflowConfig, setWorkflowConfig] = useState<ApprovalConfig["steps"]>(
    approvalConfig?.steps ?? [
      { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false },
      { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false },
      { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false },
      { stepNumber: 4, roleName: "Análise Financeira", isOpinionOnly: true },
      { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false },
    ]
  );
  const [workflowSaved, setWorkflowSaved] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState<StatusAuditoria | "all">(StatusAuditoria.PENDENTE);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ isOpen: boolean; record: IARecord | null; status: StatusAuditoria | null }>({ isOpen: false, record: null, status: null });
  const [auditComment, setAuditComment] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Statistics for the Admin Header
  const stats = useMemo(() => ({
    total: records.length,
    pending: records.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE).length,
    approved: records.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length,
    denied: records.filter(r => r.statusAuditoria === StatusAuditoria.NEGADO).length,
    sectors: new Set(records.map(r => r.unidadeSetor)).size,
    uniqueUsers: profiles.length > 0 ? profiles.length : new Set(records.map(r => r.responsavelPreenchimento)).size
  }), [records, profiles]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const recordStatus = r.statusAuditoria || StatusAuditoria.PENDENTE;
      const matchesStatus = approvalFilter === "all" || recordStatus === approvalFilter;
      const matchesSearch = r.nomeFerramenta.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.unidadeSetor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [records, approvalFilter, searchTerm]);

  const sectorData = useMemo(() => {
    const sectors: Record<string, { total: number; pending: number; approved: number; denied: number }> = {};
    records.forEach(r => {
      if (!sectors[r.unidadeSetor]) sectors[r.unidadeSetor] = { total: 0, pending: 0, approved: 0, denied: 0 };
      sectors[r.unidadeSetor].total++;
      if (r.statusAuditoria === StatusAuditoria.PENDENTE) sectors[r.unidadeSetor].pending++;
      if (r.statusAuditoria === StatusAuditoria.APROVADO) sectors[r.unidadeSetor].approved++;
      if (r.statusAuditoria === StatusAuditoria.NEGADO) sectors[r.unidadeSetor].denied++;
    });
    return Object.entries(sectors).sort((a, b) => b[1].total - a[1].total);
  }, [records]);

  const selectedSectorInfo = useMemo(() => {
    if (!selectedSector) return null;
    const sectorIAs = records.filter(r => r.unidadeSetor === selectedSector);
    const sectorUsers = Array.from(new Set(sectorIAs.map(r => r.responsavelPreenchimento)));
    return {
      name: selectedSector,
      records: sectorIAs,
      users: sectorUsers,
      stats: {
        total: sectorIAs.length,
        approved: sectorIAs.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length,
        pending: sectorIAs.filter(r => r.statusAuditoria === StatusAuditoria.PENDENTE).length,
        denied: sectorIAs.filter(r => r.statusAuditoria === StatusAuditoria.NEGADO).length
      }
    };
  }, [selectedSector, records]);

  const selectedUserInfo = useMemo(() => {
    if (!selectedUser) return null;
    
    // Find profile
    const profile = profiles.find(p => p.id === selectedUser || p.full_name === selectedUser);
    const userName = profile?.full_name || selectedUser;
    
    const userIAs = records.filter(r => 
      r.responsavelPreenchimento === userName
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      name: userName,
      profile: profile,
      records: userIAs,
      sector: profile?.setor || userIAs[0]?.unidadeSetor || "N/A",
      stats: {
        total: userIAs.length,
        approved: userIAs.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length,
        pending: userIAs.filter(r => r.statusAuditoria === StatusAuditoria.PENDENTE).length,
        denied: userIAs.filter(r => r.statusAuditoria === StatusAuditoria.NEGADO).length
      }
    };
  }, [selectedUser, records, profiles]);

  // Performance Optimization: Pre-compute and memoize user-specific metrics so keystrokes / search filter updates are O(1)
  const usersWithStats = useMemo(() => {
    const isProfile = profiles.length > 0;
    const list = isProfile 
      ? profiles 
      : Array.from(new Set(records.map(r => r.responsavelPreenchimento)))
          .map(name => ({ id: name, full_name: name, role: 'user' as const, setor: 'N/A' }));

    return list.map(userItem => {
      const userProfile = isProfile ? (userItem as UserProfile) : null;
      const userName = isProfile ? (userItem as UserProfile).full_name : (userItem as any).full_name;
      
      const userIAs = records.filter(r => r.responsavelPreenchimento === userName);
      const hasPending = userIAs.some(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE);
      const userId = userProfile?.id || userName;

      return {
        userItem,
        userProfile,
        userName,
        userIAs,
        hasPending,
        userId
      };
    });
  }, [profiles, records]);

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  return (
    <div className="space-y-8 pb-20">
      {/* Admin Hero Header */}
      <section className="relative p-10 rounded-[3rem] overflow-hidden bg-white border-2 border-[#03440c] shadow-md transition-all">
        <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 scale-110 pointer-events-none">
          <ShieldCheck size={320} className="text-[#03440c] bg-transparent" />
        </div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#03440c]/10 border border-[#03440c]/20 rounded-full text-[#03440c] text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              <Activity size={12} className="animate-pulse" /> Console de Governança
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-950 tracking-tighter uppercase leading-[0.9] mb-6">
              Central <span className="text-[#03440c]">Administrativa</span>
            </h1>
            <p className="text-slate-700 font-semibold max-w-md leading-relaxed">
              Gerencie aprovações, verifique conformidade técnica e acompanhe o ecossistema de inteligência artificial em todos os setores do laboratório.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Pendentes", value: stats.pending, color: "text-red-600", icon: AlertTriangle, bg: "bg-red-500/10", borderColor: "border-slate-200" },
              { label: "Aprovados", value: stats.approved, color: "text-[#03440c]", icon: CheckCircle2, bg: "bg-[#03440c]/10", borderColor: "border-slate-200" },
              { label: "Negados", value: stats.denied, color: "text-red-600", icon: XCircle, bg: "bg-red-500/10", borderColor: "border-slate-200" }
            ].map((s, idx) => (
              <div 
                key={idx} 
                onClick={() => { setActiveTab("approvals"); setApprovalFilter(idx === 0 ? StatusAuditoria.PENDENTE : idx === 1 ? StatusAuditoria.APROVADO : StatusAuditoria.NEGADO); setSelectedSector(null); setSelectedUser(null); }}
                className={`bg-white/80 border ${s.borderColor} p-6 rounded-[2.5rem] cursor-pointer hover:bg-white transition-all group relative overflow-hidden shadow-sm`}
              >
                <div className="absolute -right-4 -bottom-4 size-24 bg-current opacity-[0.08] rounded-full blur-2xl transition-all group-hover:scale-150" style={{ color: idx === 0 ? '#fbbf24' : idx === 1 ? '#34d399' : '#f87171' }}></div>
                <div className={`size-10 rounded-2xl ${s.bg} flex items-center justify-center ${s.color} mb-4 shadow-sm border border-black/5`}>
                   <s.icon size={20} />
                </div>
                <p className="text-4xl font-mono font-black text-slate-900 leading-none mb-1">{s.value.toString().padStart(2, '0')}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin Navigation */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-white shadow-md p-3 rounded-[2.5rem] border-2 border-[#03440c] transition-all">
        <div className="flex items-center gap-1 w-full xl:w-auto p-1 bg-slate-100 rounded-2xl border border-slate-200">
          {(["approvals", "sectors", "users"] as AdminTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedSector(null); setSelectedUser(null); }}
              className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? "bg-white text-[#03440c] shadow-sm border border-slate-200" 
                : "text-slate-700 hover:text-slate-950"
              }`}
            >
              {tab === "approvals" ? "Solicitações" : tab === "sectors" ? "Setores" : tab === "users" ? "Usuários" : "Fluxo de Aprovação"}
            </button>
          ))}
        </div>

        {activeTab === "approvals" && (
          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto px-4">
            <div className="flex items-center gap-1 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              {[
                { label: "Todos", value: "all" },
                { label: "Pendentes", value: StatusAuditoria.PENDENTE },
                { label: "Aprovados", value: StatusAuditoria.APROVADO },
                { label: "Negados", value: StatusAuditoria.NEGADO }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setApprovalFilter(opt.value as any)}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    approvalFilter === opt.value 
                    ? "bg-white text-[#03440c] shadow-sm scale-105 border border-slate-200" 
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-200/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 sm:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#03440c] transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Buscar IA, ID ou Setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-500 focus:border-[#03440c] focus:ring-2 focus:ring-[#03440c]/10 outline-none transition-all"
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + (activeTab === "approvals" ? approvalFilter : "") + (selectedSector || "") + (selectedUser || "")}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "approvals" && (
            <div className="grid grid-cols-1 gap-4">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <div key={record.id} className="bg-white dark:bg-white/5 p-6 rounded-[2.5rem] border border-emerald-200/60/40 shadow-xl shadow-emerald-200/5 dark:shadow-none hover:border-emerald-500/50 hover:shadow-emerald-400/10 transition-all group flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                      record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-emerald-500" :
                      record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-lab-red" :
                      "bg-amber-500"
                    }`}></div>
                    
                    <div className="size-16 rounded-2xl bg-white/60 dark:bg-white/5 border border-emerald-100 dark:border-emerald-800/20 flex items-center justify-center text-emerald-500 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                      <Database size={32} />
                    </div>
                    
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-emerald-700 dark:text-brand-green uppercase tracking-tight truncate">{record.nomeFerramenta}</h3>
                        <span className="text-[10px] font-mono text-emerald-900 dark:text-white bg-white/50 dark:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-200/50/30 whitespace-nowrap">{record.id}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        <button 
                          onClick={() => { setActiveTab("sectors"); setSelectedSector(record.unidadeSetor); }}
                          className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:underline border-r border-emerald-200 dark:border-emerald-800/30 pr-4"
                        >
                          <LayoutGrid size={12} /> {record.unidadeSetor}
                        </button>
                        <span className="flex items-center gap-1.5 text-emerald-600 group-hover:text-emerald-600 dark:group-hover:text-brand-green transition-colors"><Users size={12} /> {record.responsavelPreenchimento}</span>
                        <span className="flex items-center gap-1.5 text-emerald-600"><AlertTriangle size={12} /> {new Date(record.createdAt).toLocaleDateString()}</span>
                        <span className={`flex items-center gap-1 mt-1 sm:mt-0 ${record.usaDadosSensiveis === "Sim" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600/60 dark:text-emerald-500/60"}`}>
                          <ShieldAlert size={12} /> {record.usaDadosSensiveis === "Sim" ? "Dados Sensíveis" : "Dados Comuns"}
                        </span>
                      </div>
                      {record.historico && record.historico.length > 0 && (
                        <div className="mt-3 flex items-start gap-2 bg-emerald-50/30 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/10 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-900/30 transition-colors">
                          <Activity size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-black text-emerald-700 dark:text-white uppercase tracking-widest leading-none">{record.historico[0].action}</p>
                            <p className="text-[10px] text-emerald-900 dark:text-white font-medium line-clamp-1">{record.historico[0].message}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 border-l border-emerald-100 dark:border-emerald-800/20 pl-6">
                      <div className="text-right mr-4 hidden sm:block">
                         <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Resultado Final</p>
                         <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border shadow-sm ${
                           record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-brand-green/10 text-brand-green border-brand-green/20" :
                           record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-lab-red/10 text-lab-red border-lab-red/20" :
                           "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
                         }`}>
                           {record.statusAuditoria || "Pendente"}
                         </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        {(record.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE ? (
                          <>
                            <button 
                              onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.APROVADO })}
                              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-green-500/20 active:scale-95"
                            >
                              <CheckCircle2 size={16} /> Aprovar Uso
                            </button>
                            <button 
                              onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.NEGADO })}
                              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20 active:scale-95"
                            >
                              <ShieldX size={16} /> IA indeferida
                            </button>
                          </>
                        ) : (
                          <button 
                             onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.PENDENTE })}
                             className="size-11 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center justify-center border border-amber-600/20 group-hover:scale-110 active:scale-90 shadow-lg shadow-amber-500/20"
                             title="Redefinir Resultado"
                          >
                             <AlertTriangle size={20} />
                          </button>
                        )}
                        <button 
                          onClick={() => onViewRecord(record)}
                          className="size-11 rounded-xl bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange hover:bg-brand-orange hover:text-white transition-all flex items-center justify-center border border-brand-orange/20 dark:border-brand-orange/40 group-hover:scale-110 active:scale-90"
                          title="Ficha Técnica Completa"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-white/5 shadow-inner">
                  <div className="size-24 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-6 border border-slate-100 dark:border-white/10 shadow-sm">
                    <ShieldAlert size={36} className="text-slate-300 dark:text-slate-700" />
                  </div>
                  <h4 className="text-slate-900 dark:text-white font-black uppercase tracking-tight text-2xl mb-2">Sem Resultados</h4>
                  <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum registro coincide com o filtro atual</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "sectors" && !selectedSector && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sectorData.map(([sector, data], i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedSector(sector)}
                  className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-emerald-200/50/30 shadow-lg shadow-emerald-200/5 dark:shadow-none relative overflow-hidden group hover:border-emerald-400/40 hover:shadow-emerald-400/10 transition-all hover:-translate-y-1 cursor-pointer"
                >
                  <div className="absolute -top-4 -right-4 size-32 bg-emerald-400/5 rounded-full blur-2xl group-hover:bg-emerald-400/10 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div className="size-12 rounded-xl bg-white dark:bg-white/5 border border-emerald-50 dark:border-white/10 flex items-center justify-center text-emerald-500 shadow-sm">
                        <LayoutGrid size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                        {data.pending > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-[8px] font-black rounded border border-yellow-200 dark:border-yellow-500/20 uppercase tracking-widest animate-pulse">
                            {data.pending} Pend.
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-green-50 dark:bg-brand-green/10 text-green-600 dark:text-brand-green text-[8px] font-black rounded border border-green-200 dark:border-brand-green/20 uppercase tracking-widest">
                          {data.approved} Apr.
                        </span>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-emerald-600 dark:text-brand-green uppercase tracking-tight mb-2 truncate">{sector}</h3>
                    <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mb-6 flex">
                       <div style={{ width: `${(data.approved/data.total)*100}%` }} className="h-full bg-brand-green shadow-[0_0_8px_rgba(0,255,65,0.4)]"></div>
                       <div style={{ width: `${(data.pending/data.total)*100}%` }} className="h-full bg-brand-orange shadow-[0_0_8px_rgba(234,179,8,0.4)]"></div>
                       <div style={{ width: `${(data.denied/data.total)*100}%` }} className="h-full bg-lab-red shadow-[0_0_8px_rgba(255,75,75,0.4)]"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total de IAs</p>
                        <p className="text-xl font-black text-emerald-600 dark:text-brand-green">{data.total.toString().padStart(2, '0')}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Taxa de Aprovação</p>
                        <p className="text-xl font-black text-brand-green">
                          {data.total > 0 ? Math.round(((data.approved) / data.total) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "sectors" && selectedSector && selectedSectorInfo && (
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedSector(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-lab-cyan font-black uppercase text-[10px] tracking-widest mb-2 transition-colors"
              >
                <ChevronLeft size={16} /> Voltar para Setores
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Stats Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-emerald-200/60/40 shadow-xl shadow-slate-200/30 dark:shadow-none">
                    <div className="size-16 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center text-lab-cyan shadow-sm mb-6">
                      <LayoutGrid size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 leading-tight">{selectedSectorInfo.name}</h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-4">Detalhamento Setorial</p>
                    
                    <div className="space-y-4 mt-6">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/10">
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total de IAs</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-brand-green">{selectedSectorInfo.stats.total}</span>
                      </div>
                      <div className="flex justify-between items-center bg-brand-green/5 p-4 rounded-2xl border border-brand-green/10">
                        <span className="text-[10px] font-black text-brand-green uppercase tracking-widest">Aprovadas</span>
                        <span className="text-lg font-black text-brand-green">{selectedSectorInfo.stats.approved}</span>
                      </div>
                      <div className="flex justify-between items-center bg-yellow-500/5 p-4 rounded-2xl border border-yellow-500/10">
                        <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">Pendentes</span>
                        <span className="text-lg font-black text-yellow-600">{selectedSectorInfo.stats.pending}</span>
                      </div>
                      <div className="flex justify-between items-center bg-lab-red/5 p-4 rounded-2xl border border-lab-red/10">
                        <span className="text-[10px] font-black text-lab-red uppercase tracking-widest">Negadas</span>
                        <span className="text-lg font-black text-lab-red">{selectedSectorInfo.stats.denied}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl shadow-slate-200/30 dark:shadow-none">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                       <Users size={16} className="text-lab-cyan" /> Usuários Ativos
                    </h3>
                    <div className="space-y-3">
                      {selectedSectorInfo.users.map((user, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-50 dark:border-white/10 group/u cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-colors" onClick={() => setSelectedUser(user)}>
                          <div className="size-8 rounded-lg bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/20 flex items-center justify-center text-lab-blue text-[10px] font-black overflow-hidden group-hover/u:border-lab-cyan">
                            <img 
                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user)}&backgroundColor=0ea5e9,0284c7&fontSize=42&bold=true`} 
                              alt={user}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase truncate group-hover/u:text-lab-cyan transition-colors">{user}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 space-y-6">
                  {selectedSectorInfo.records.map((record) => (
                    <div key={record.id} className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-emerald-200/60/40 shadow-xl shadow-emerald-200/5 dark:shadow-none hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-emerald-500" :
                        record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-lab-red" :
                        "bg-brand-orange"
                      }`}></div>
                      
                      <div className="size-14 rounded-2xl bg-white/60 dark:bg-white/5 border border-emerald-100/30 dark:border-emerald-800/20 flex items-center justify-center text-emerald-500 shrink-0">
                        <Database size={24} />
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <h4 className="font-black text-emerald-700 dark:text-brand-green uppercase tracking-tight">{record.nomeFerramenta}</h4>
                        <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-widest text-emerald-600/60 dark:text-emerald-500/60">
                          <span className="flex items-center gap-1"><Users size={10} /> {record.responsavelPreenchimento}</span>
                          <span className="flex items-center gap-1"><Activity size={10} /> {record.fornecedor}</span>
                          <span className={`px-2 py-0.5 rounded ${record.statusAuditoria === StatusAuditoria.APROVADO ? 'bg-emerald-500 text-white font-black' : record.statusAuditoria === StatusAuditoria.NEGADO ? 'bg-red-50 dark:bg-lab-red/10 text-red-600 dark:text-lab-red' : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'}`}>
                            {record.statusAuditoria}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {(record.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE ? (
                          <div className="flex gap-2 mr-2">
                            <button 
                              onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.APROVADO })}
                              className="px-5 py-2.5 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95 flex items-center gap-2"
                            >
                              <CheckCircle2 size={14} /> Aprovar Uso
                            </button>
                            <button 
                              onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.NEGADO })}
                              className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center gap-2"
                            >
                              <ShieldX size={14} /> IA indeferida
                            </button>
                          </div>
                        ) : (
                          <button 
                             onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.PENDENTE })}
                             className="px-6 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-amber-600/20 flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                          >
                             Redefinir <AlertTriangle size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => onViewRecord(record)}
                          className="size-11 rounded-xl bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shrink-0 flex items-center justify-center border border-brand-orange/20 dark:border-brand-orange/40 group-hover:scale-110 active:scale-90"
                          title="Ficha Técnica"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && !selectedUser && (
            <div className="bg-white dark:bg-white/5 rounded-[3rem] border border-emerald-200/60/40 overflow-hidden shadow-xl shadow-emerald-200/5 dark:shadow-none">
               <div className="p-8 border-b border-emerald-100/30 dark:border-emerald-900/30 bg-white/50 dark:bg-black/20 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Responsáveis</h3>
                    <p className="text-[10px] text-emerald-600/60 dark:text-emerald-500/60 font-extrabold uppercase tracking-[0.2em] mt-1">Gestão de acessos e responsabilidade técnica</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-white dark:bg-white/10 rounded-full text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border border-emerald-100/50/20 shadow-sm">Total: {stats.uniqueUsers} Usuários</span>
                  </div>
               </div>
               <table className="w-full text-left">
                  <thead className="bg-emerald-50/10 dark:bg-white/[0.01] border-b border-emerald-100/30 dark:border-white/5">
                    <tr>
                      <th className="px-8 py-6 text-[10px] font-black text-emerald-600/60 dark:text-emerald-500/60 uppercase tracking-[0.2em]">Responsável</th>
                      <th className="px-8 py-6 text-[10px] font-black text-emerald-600/60 dark:text-emerald-500/60 uppercase tracking-[0.2em]">Setor</th>
                      <th className="px-8 py-6 text-[10px] font-black text-emerald-600/60 dark:text-emerald-500/60 uppercase tracking-[0.2em]">IA's Sob Custódia</th>
                      <th className="px-8 py-6 text-[10px] font-black text-emerald-600/60 dark:text-emerald-500/60 uppercase tracking-[0.2em]">Status Governança</th>
                      <th className="px-8 py-6 text-[10px] font-black text-emerald-600/60 dark:text-emerald-500/60 uppercase tracking-[0.2em] text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100/30 dark:divide-white/5">
                    {usersWithStats.map(({ userItem, userProfile, userName, userIAs, hasPending, userId }, i) => {
                      return (
                        <tr key={userId + i} className="hover:bg-white/60 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div 
                                onClick={() => setSelectedUser(userName)}
                                className="size-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-lab-blue dark:text-lab-cyan font-black shadow-sm group-hover:bg-lab-cyan group-hover:text-white dark:group-hover:text-slate-900 group-hover:border-lab-cyan transition-all group-hover:scale-105 active:scale-95 cursor-pointer overflow-hidden"
                              >
                                <img 
                                  src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}&backgroundColor=0ea5e9,0284c7&fontSize=42&bold=true`} 
                                  alt={userName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-base font-black text-emerald-900 dark:text-brand-green uppercase tracking-tight">{userName}</p>
                                {userProfile?.role?.toLowerCase().trim() === "admin" && (
                                  <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                    <ShieldCheck size={10} /> Admin
                                  </span>
                                )}
                                {!userProfile && (
                                  <span className="px-1.5 py-0.5 bg-slate-500/10 border border-slate-500/20 rounded text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                    <AlertTriangle size={8} /> Sem Conta
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <button 
                              onClick={() => { 
                                const sector = userProfile?.setor || (userIAs.length > 0 ? userIAs[0].unidadeSetor : null);
                                if (sector) {
                                  setActiveTab("sectors"); 
                                  setSelectedSector(sector);
                                }
                              }}
                              className="text-[10px] text-lab-cyan font-bold uppercase tracking-widest hover:underline"
                             >
                              {userProfile?.setor || (userIAs.length > 0 ? userIAs[0].unidadeSetor : "Nenhum setor")}
                            </button>
                          </td>
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-3 font-mono text-sm">
                               <span className="text-emerald-600 dark:text-brand-green font-bold">{userIAs.length.toString().padStart(2, '0')}</span>
                               <div className="flex -space-x-2">
                                 {userIAs.slice(0, 3).map((_, idx) => (
                                   <div key={idx} className="size-6 rounded-full bg-slate-100 dark:bg-white/10 border-2 border-white dark:border-slate-800 transition-colors shadow-sm"></div>
                                 ))}
                                 {userIAs.length > 3 && (
                                   <div className="size-6 rounded-full bg-slate-200 dark:bg-white/20 border-2 border-white dark:border-slate-800 text-[8px] flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">+{userIAs.length - 3}</div>
                                 )}
                               </div>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                            {hasPending ? (
                              <span className="flex items-center gap-2 text-red-600 text-[10px] font-black uppercase tracking-widest bg-red-50 dark:bg-red-500/10 px-3 py-1 rounded-full border border-red-200 dark:border-red-500/20">
                                <AlertTriangle size={12} /> Ação Necessária
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 text-brand-green text-[10px] font-black uppercase tracking-widest bg-green-50 dark:bg-brand-green/10 px-3 py-1 rounded-full border border-green-200 dark:border-brand-green/20">
                                <ShieldCheck size={12} /> Conformidade Total
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                          {onUpdateUserRole && (
                            <button 
                              disabled={updatingUserId === userId || !userProfile}
                              onClick={async () => {
                                if (!userProfile) return;
                                console.log("Updating role for user:", userProfile.id, userProfile.full_name);
                                setUpdatingUserId(userProfile.id);
                                try {
                                  const isUserAdmin = userProfile?.role?.toLowerCase().trim() === "admin";
                                  await onUpdateUserRole(userProfile.id, isUserAdmin ? "user" : "admin");
                                } finally {
                                  setUpdatingUserId(null);
                                }
                              }}
                              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                                !userProfile
                                ? "bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 cursor-not-allowed"
                                : userProfile?.role?.toLowerCase().trim() === "admin" 
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white" 
                                : "bg-brand-green/10 text-brand-green border-brand-green/20 hover:bg-brand-green hover:text-black"
                              } ${updatingUserId === (userProfile?.id || "") ? "opacity-50 cursor-wait" : ""}`}
                              title={!userProfile ? "Este usuário não possui conta no sistema" : userProfile?.role?.toLowerCase().trim() === "admin" ? "Remover Admin" : "Tornar Admin"}
                            >
                              {updatingUserId === (userProfile?.id || "") ? (
                                <span className="animate-spin size-3 border-2 border-current border-t-transparent rounded-full" />
                              ) : null}
                              {userProfile?.role?.toLowerCase().trim() === "admin" ? "Revogar Admin" : "Tornar Admin"}
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedUser(userName)}
                            className="px-4 py-2 bg-white dark:bg-white/5 hover:bg-slate-900 dark:hover:bg-lab-cyan hover:text-white dark:hover:text-slate-900 rounded-lg text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 transition-all border border-slate-50 dark:border-white/10 hover:border-slate-800 dark:hover:border-lab-cyan"
                          >
                            Histórico <ArrowUpRight size={14} />
                          </button>

                          {onDeleteUser && userProfile && (
                             <div className="relative">
                               <AnimatePresence>
                                {showDeleteConfirm === userProfile.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 bottom-full mb-2 p-3 bg-white dark:bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl z-50 min-w-[200px]"
                                  >
                                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase mb-2 text-center">Confirmar exclusão permanente?</p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="flex-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-md transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={async () => {
                                          setDeletingUserId(userProfile.id);
                                          try {
                                            await onDeleteUser(userProfile.id);
                                          } finally {
                                            setDeletingUserId(null);
                                            setShowDeleteConfirm(null);
                                          }
                                        }}
                                        disabled={deletingUserId === userProfile.id}
                                        className="flex-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors flex items-center justify-center gap-1"
                                      >
                                        {deletingUserId === userProfile.id ? <span className="animate-spin size-2 border border-white border-t-transparent rounded-full" /> : null}
                                        Excluir
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                               </AnimatePresence>

                               <button
                                 onClick={() => setShowDeleteConfirm(userProfile.id)}
                                 disabled={deletingUserId === userProfile.id}
                                 className={`size-9 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 rounded-lg transition-all ${deletingUserId === userProfile.id ? 'opacity-50 cursor-wait' : ''}`}
                                 title="Apagar Conta Permanentemente"
                               >
                                 <ShieldX size={14} />
                               </button>
                             </div>
                          )}
                        </div>
                      </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          )}

          {activeTab === "users" && selectedUser && selectedUserInfo && (
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedUser(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-lab-cyan font-black uppercase text-[10px] tracking-widest mb-2 transition-all hover:translate-x-[-4px]"
              >
                <ChevronLeft size={16} /> Voltar para lista de usuários
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Profile Profile Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-emerald-200/60/40 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-lab-blue/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    
                    <div className="relative z-10">
                      <div className="size-24 rounded-[2.5rem] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-lab-blue text-3xl font-black shadow-xl mb-6 ring-4 ring-white dark:ring-slate-800 overflow-hidden group/avatar">
                        <img 
                          src={selectedUserInfo.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(selectedUserInfo.name)}&backgroundColor=0ea5e9,0284c7&fontSize=42&bold=true`} 
                          alt={selectedUserInfo.name}
                          className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500"
                        />
                      </div>
                      
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-green/10 border border-brand-green/20 rounded-full text-brand-green text-[8px] font-black uppercase tracking-widest mb-4">
                        <ShieldCheck size={10} /> Perfil {selectedUserInfo.profile?.status === 'Autorizado' ? 'Ativo' : selectedUserInfo.profile?.status || 'Pendente'}
                      </div>

                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-3xl font-black text-emerald-900 dark:text-brand-green uppercase tracking-tight leading-tight">{selectedUserInfo.name}</h2>
                        {selectedUserInfo.profile?.role?.toLowerCase().trim() === "admin" && (
                          <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 shrink-0 mt-1">
                            <ShieldCheck size={12} /> Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-lab-cyan font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-1.5">
                        <LayoutGrid size={12} /> {selectedUserInfo.sector}
                      </p>
                      
                      <div className="space-y-1.5 border-t border-slate-100 dark:border-white/5 pt-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cargo / Função</span>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{selectedUserInfo.profile?.cargo || "Colaborador"}</span>
                        </div>
                        <div className="flex flex-col gap-1 mt-3">
                          <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nível de Acesso</span>
                          <span className="text-[10px] font-black text-lab-blue dark:text-lab-cyan uppercase">{selectedUserInfo.profile?.role?.toLowerCase().trim() === 'admin' ? 'Administrador' : 'Editor de Inventário'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-emerald-200/60/40 shadow-xl shadow-slate-200/30 dark:shadow-none">
                    <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 dark:border-white/5 pb-2">Métricas de Atividade</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/10 group hover:border-lab-cyan/30 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">IAs Registradas</span>
                          <span className="text-xl font-black text-emerald-600 dark:text-brand-green">{selectedUserInfo.stats.total.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="size-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-400">
                          <Database size={18} />
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-brand-green/5 p-4 rounded-2xl border border-brand-green/10">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-brand-green/70 uppercase tracking-widest">Aprovações</span>
                          <span className="text-xl font-black text-brand-green">{selectedUserInfo.stats.approved.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="size-10 rounded-xl bg-white dark:bg-slate-900 border border-brand-green/10 flex items-center justify-center text-brand-green">
                          <CheckCircle2 size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content Area - User's Registry */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Ferramentas Sob Custódia</h3>
                    <div className="h-px flex-1 mx-6 bg-slate-100 dark:bg-white/5"></div>
                  </div>

                  {selectedUserInfo.records.map((record) => (
                    <div key={record.id} className="bg-white dark:bg-white/5 p-6 rounded-[2.5rem] border border-emerald-200/60/40 shadow-xl shadow-emerald-200/5 dark:shadow-none hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row items-center gap-8 relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-2 h-full ${
                        record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-emerald-500" :
                        record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-lab-red" :
                        "bg-brand-orange"
                      }`}></div>
                      
                      <div className="shrink-0 flex flex-col items-center">
                        <div className="size-14 rounded-2xl bg-white/60 dark:bg-white/5 border border-emerald-100/30 dark:border-emerald-800/20 flex items-center justify-center text-emerald-500 group-hover:text-emerald-400 transition-colors mb-2">
                          <Database size={24} />
                        </div>
                        <div className="text-[8px] font-black text-emerald-900 dark:text-white uppercase tracking-tighter">ID: {record.id.slice(-4)}</div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                           <h4 className="text-lg font-black text-emerald-700 dark:text-brand-green uppercase tracking-tight">{record.nomeFerramenta}</h4>
                           <span className={`text-[8px] px-3 py-0.5 rounded-full font-black uppercase tracking-widest border shadow-sm ${
                             record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-green-50 dark:bg-brand-green/10 text-green-600 dark:text-brand-green border-green-200 dark:border-brand-green/30" :
                             record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-red-50 dark:bg-lab-red/10 text-red-600 dark:text-lab-red border-red-200 dark:border-lab-red/30" :
                             "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-200 dark:border-yellow-500/30"
                           }`}>
                             {record.statusAuditoria}
                           </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5"><Activity size={12} className="text-slate-300 dark:text-slate-600" /> {record.fornecedor}</span>
                          <span className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-slate-300 dark:text-slate-600" /> Registrado em {new Date(record.createdAt).toLocaleDateString()}</span>
                          {record.usaDadosSensiveis === "Sim" && (
                            <span className="flex items-center gap-1.5 text-brand-orange bg-brand-orange/5 px-2 py-0.5 rounded border border-brand-orange/10">
                              <ShieldAlert size={12} /> Dados Sensíveis
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-emerald-900 dark:text-white leading-relaxed font-semibold bg-emerald-50/20 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/10 group-hover:bg-emerald-50/40 dark:group-hover:bg-emerald-900/30 transition-colors">
                           {record.historico[0]?.message || "Esta ferramenta foi integrada ao inventário técnico para avaliação de governança e conformidade operacional."}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 self-center sm:self-auto">
                        {(record.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE && (
                          <div className="flex gap-2 mr-2">
                            <button 
                              onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.APROVADO })}
                              className="px-6 py-3 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-xl shadow-green-500/20 active:scale-95 flex items-center gap-2"
                            >
                              <CheckCircle2 size={16} /> Aprovar IA
                            </button>
                            <button 
                              onClick={() => setDecisionModal({ isOpen: true, record, status: StatusAuditoria.NEGADO })}
                              className="px-6 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95 flex items-center gap-2"
                            >
                              <ShieldX size={16} /> IA indeferida
                            </button>
                          </div>
                        )}
                        <button 
                          onClick={() => onViewRecord(record)}
                          className="size-12 rounded-2xl bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shrink-0 flex items-center justify-center border border-brand-orange/20 dark:border-brand-orange/40 group-hover:scale-110 active:scale-90"
                          title="Ficha Técnica"
                        >
                          <MoreHorizontal size={24} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {selectedUserInfo.records.length === 0 && (
                    <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum registro encontrado para este usuário</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "workflow" && (
            <div className="space-y-6 p-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-black text-[var(--text-bright)] uppercase tracking-tight">Configurar Fluxo de Aprovação</h3>
                  <p className="text-xs text-[var(--text-muted)] font-bold mt-1">Defina quais usuários participam de cada etapa do processo de aprovação das IAs cadastradas.</p>
                </div>
                {workflowSaved && (
                  <span className="text-xs font-black text-brand-green bg-brand-green/10 border border-brand-green/20 px-3 py-1.5 rounded-xl uppercase">✓ Configuração salva</span>
                )}
              </div>

              <div className="space-y-4">
                {workflowConfig.map((step, idx) => (
                  <div key={step.stepNumber} className="glass border border-[var(--border-lab)] rounded-2xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                        step.isOpinionOnly
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                          : "bg-brand-green/10 border-brand-green/30 text-brand-green"
                      }`}>
                        {step.stepNumber}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={step.roleName}
                          onChange={(e) => {
                            const updated = [...workflowConfig];
                            updated[idx] = { ...updated[idx], roleName: e.target.value };
                            setWorkflowConfig(updated);
                            setWorkflowSaved(false);
                          }}
                          className="w-full bg-transparent font-black text-[var(--text-bright)] text-sm border-b border-[var(--border-lab)] focus:border-brand-green outline-none pb-1 transition-colors"
                        />
                        <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Nome do papel/cargo</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Apenas Opinião</label>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...workflowConfig];
                            updated[idx] = { ...updated[idx], isOpinionOnly: !updated[idx].isOpinionOnly };
                            setWorkflowConfig(updated);
                            setWorkflowSaved(false);
                          }}
                          className={`relative w-10 h-5 rounded-full transition-all border ${
                            step.isOpinionOnly
                              ? "bg-amber-500 border-amber-500"
                              : "bg-black/10 border-[var(--border-lab)]"
                          }`}
                        >
                          <div className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${step.isOpinionOnly ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Usuário Responsável</label>
                      <select
                        value={step.userId ?? ""}
                        onChange={(e) => {
                          const selectedProfile = profiles.find(p => p.id === e.target.value);
                          const updated = [...workflowConfig];
                          updated[idx] = {
                            ...updated[idx],
                            userId: e.target.value || undefined,
                            userName: selectedProfile?.full_name || undefined,
                          };
                          setWorkflowConfig(updated);
                          setWorkflowSaved(false);
                        }}
                        className="w-full px-4 py-3 bg-black/5 border border-[var(--border-lab)] rounded-xl text-sm text-[var(--text-bright)] font-semibold outline-none focus:border-brand-green transition-all"
                      >
                        <option value="">— Selecione um usuário —</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name} {p.cargo ? `(${p.cargo})` : ""}</option>
                        ))}
                      </select>
                    </div>

                    {step.isOpinionOnly && (
                      <p className="mt-3 text-[9px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 font-bold uppercase tracking-wide">
                        ⚠ Esta etapa é apenas uma opinião — mesmo que negada, a IA avança para a próxima etapa.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  if (onSaveApprovalConfig) {
                    onSaveApprovalConfig({ steps: workflowConfig });
                    setWorkflowSaved(true);
                    setTimeout(() => setWorkflowSaved(false), 3000);
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-brand-green to-lab-cyan text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg hover:shadow-lab-cyan/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                Salvar Configuração do Fluxo
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {decisionModal.isOpen && decisionModal.record && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDecisionModal({ isOpen: false, record: null, status: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-gradient-to-br from-white via-[#006400] to-[#03440c] rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className={`size-16 rounded-2xl flex items-center justify-center shadow-lg ${
                    decisionModal.status === StatusAuditoria.APROVADO 
                      ? "bg-[#03440c] text-white" 
                      : decisionModal.status === StatusAuditoria.NEGADO 
                        ? "bg-red-700 text-white" 
                        : "bg-amber-600 text-white"
                  }`}>
                    {decisionModal.status === StatusAuditoria.APROVADO ? <CheckCircle2 size={32} /> : 
                     decisionModal.status === StatusAuditoria.NEGADO ? <ShieldX size={32} /> : 
                     <AlertTriangle size={32} />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-tight">
                      {decisionModal.status === StatusAuditoria.APROVADO ? "Aprovar IA para Uso" : 
                       decisionModal.status === StatusAuditoria.NEGADO ? "Negar Solicitação" : 
                       "Redefinir Resultado"}
                    </h3>
                    <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.2em]">{decisionModal.record.nomeFerramenta}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-black/5 dark:bg-black/15 p-6 rounded-2xl border border-black/5 flex items-center gap-6">
                    <div className="flex-1">
                      <p className="text-[8px] font-black text-[#03440c]/70 uppercase tracking-widest mb-1">Setor</p>
                      <p className="text-xs font-black text-slate-900 uppercase">{decisionModal.record.unidadeSetor}</p>
                      <p className="text-[10px] font-bold text-slate-800 mt-0.5">{decisionModal.record.responsavelPreenchimento}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-200"></div>
                    <div className="flex-1">
                      <p className="text-[8px] font-black text-[#03440c]/70 uppercase tracking-widest mb-1">Natureza de Uso</p>
                      <p className="text-xs font-black text-slate-900 uppercase">{decisionModal.record.naturezaUso}</p>
                      <p className="text-[10px] font-bold text-amber-700 mt-0.5 drop-shadow-[0_0_8px_rgba(255,165,0,0.4)]">{decisionModal.record.usaDadosSensiveis === 'Sim' ? 'DADOS SENSÍVEIS' : 'DADOS COMUNS'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#03440c] uppercase tracking-[0.2em] flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-[#03440c] shadow-[0_0_8px_rgba(3,68,12,0.5)]"></div> Parecer da Auditoria
                    </label>
                    <textarea 
                      value={auditComment}
                      onChange={(e) => setAuditComment(e.target.value)}
                      placeholder="Descreva aqui o motivo da aprovação ou reprovação, indicando possíveis ajustes técnicos ou restrições de uso..."
                      className="w-full h-32 bg-white border border-[#03440c]/20 text-slate-900 placeholder-slate-400 rounded-2xl p-4 text-xs font-semibold focus:border-[#03440c] focus:ring-2 focus:ring-[#03440c]/10 outline-none transition-all resize-none shadow-inner"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button 
                      onClick={() => setDecisionModal({ isOpen: false, record: null, status: null })}
                      className="flex-1 py-4 text-[#03440c] hover:text-[#006400] font-black uppercase text-[10px] tracking-[0.2em] transition-all hover:bg-black/5 rounded-2xl"
                    >
                      Cancelar Operação
                    </button>
                    <button 
                      onClick={() => {
                        if (decisionModal.record && decisionModal.status) {
                          onUpdateStatus(decisionModal.record.id, decisionModal.status, auditComment);
                          setDecisionModal({ isOpen: false, record: null, status: null });
                          setAuditComment("");
                        }
                      }}
                      className="flex-[2] py-5 rounded-2xl font-black uppercase text-[12px] tracking-[0.1em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 bg-[#03440c] text-white hover:bg-[#03440c]/90 shadow-[#03440c]/10"
                    >
                      {decisionModal.status === StatusAuditoria.APROVADO ? <CheckCircle2 size={20} /> : 
                       decisionModal.status === StatusAuditoria.NEGADO ? <XCircle size={20} /> : 
                       <AlertTriangle size={20} />}
                      Confirmar {decisionModal.status === StatusAuditoria.APROVADO ? "APROVAÇÃO" : 
                                decisionModal.status === StatusAuditoria.NEGADO ? "INDEFERIMENTO" : 
                                "REDEFINIÇÃO"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
