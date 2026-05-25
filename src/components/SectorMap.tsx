/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Users, Layout, ChevronRight, User, ShieldCheck, Clock, Layers, X, Plus } from "lucide-react";
import { IARecord, UserProfile } from "../types";
import { motion, AnimatePresence } from "framer-motion";

interface SectorMapProps {
  records: IARecord[];
  profiles: UserProfile[];
}

export default function SectorMap({ records, profiles }: SectorMapProps) {
  const [selectedIA, setSelectedIA] = useState<IARecord | null>(null);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  // Group records by sector
  const sectorGroups = useMemo(() => {
    const groups: Record<string, {
      sector: string;
      records: IARecord[];
      totalIAs: number;
      authorizedCount: number;
      pendingCount: number;
      users: Set<string>;
    }> = {};

    records.forEach(r => {
      const sector = r.unidadeSetor || "Não Informado";
      if (!groups[sector]) {
        groups[sector] = {
          sector,
          records: [],
          totalIAs: 0,
          authorizedCount: 0,
          pendingCount: 0,
          users: new Set(),
        };
      }
      
      groups[sector].records.push(r);
      groups[sector].totalIAs++;
      if (r.statusAuditoria === "Aprovado") groups[sector].authorizedCount++;
      if (r.statusAuditoria === "Pendente") groups[sector].pendingCount++;
      if (r.responsavelPreenchimento) groups[sector].users.add(r.responsavelPreenchimento);
    });

    return Object.values(groups).sort((a, b) => b.totalIAs - a.totalIAs);
  }, [records]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-end gap-4 px-2">
        <div className="flex gap-4">
           <div className="glass px-4 py-2 rounded-xl border border-[var(--border-lab)]">
             <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block">Total Setores</span>
             <span className="text-xl font-bold text-lab-cyan">{sectorGroups.length}</span>
           </div>
           <div className="glass px-4 py-2 rounded-xl border border-[var(--border-lab)]">
             <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block">Colaboradores</span>
             <span className="text-xl font-bold text-brand-green">
               {profiles.length > 0 ? profiles.length : new Set(records.map(r => r.responsavelPreenchimento)).size}
             </span>
           </div>
        </div>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-2 gap-8"
      >
        {sectorGroups.map((group, idx) => {
          const density = group.totalIAs >= 6 ? 'high' : group.totalIAs >= 3 ? 'medium' : 'low';
          const densityStyles = {
            high: { border: 'border-emerald-800/60 shadow-[0_0_25px_rgba(6,95,70,0.15)]', dot: 'bg-emerald-800 animate-pulse', label: 'Alta Densidade de IA', text: 'text-emerald-800', badge: 'bg-emerald-800/10 text-emerald-800', title: 'text-emerald-900 dark:text-emerald-400' },
            medium: { border: 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]', dot: 'bg-emerald-500', label: 'Média Densidade de IA', text: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-500', title: 'text-emerald-700 dark:text-emerald-400' },
            low: { border: 'border-emerald-300/40 shadow-[0_0_15px_rgba(110,231,183,0.05)]', dot: 'bg-emerald-300', label: 'Baixa Densidade de IA', text: 'text-emerald-300', badge: 'bg-emerald-300/10 text-emerald-300', title: 'text-emerald-600 dark:text-emerald-500' }
          }[density];

          return (
            <motion.div 
              key={idx} 
              variants={item}
              className={`glass rounded-[2.5rem] p-8 border ${densityStyles.border} relative overflow-hidden group hover:border-emerald-500/50 transition-all`}
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <Users size={120} />
              </div>

              <div className="flex items-start justify-between mb-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`size-2 rounded-full ${densityStyles.dot}`}></div>
                    <span className={`text-[10px] font-black ${densityStyles.text} uppercase tracking-[0.2em]`}>
                      {densityStyles.label}
                    </span>
                    {group.totalIAs > 1 && (
                      <span className={`${densityStyles.badge} text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter`}>MULTI-IA</span>
                    )}
                  </div>
                  <h3 className={`text-2xl font-black ${densityStyles.title} tracking-tight uppercase group-hover:text-lab-cyan transition-colors`}>
                    {group.sector}
                  </h3>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-3xl font-black ${densityStyles.text}`}>{group.totalIAs}</span>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Aplicações IA</span>
                </div>
              </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-[var(--border-lab)]">
                <div className="flex items-center gap-2 text-brand-green mb-1">
                  <ShieldCheck size={14} />
                  <span className="text-[10px] font-black uppercase">Autorizadas</span>
                </div>
                <span className="text-lg font-bold text-[var(--text-main)]">{group.authorizedCount}</span>
              </div>
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-[var(--border-lab)]">
                <div className="flex items-center gap-2 text-brand-orange mb-1">
                  <Clock size={14} />
                  <span className="text-[10px] font-black uppercase">Pendentes</span>
                </div>
                <span className="text-lg font-bold text-[var(--text-main)]">{group.pendingCount}</span>
              </div>
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-[var(--border-lab)]">
                <div className="flex items-center gap-2 text-lab-blue mb-1">
                  <User size={14} />
                  <span className="text-[10px] font-black uppercase">Usuários</span>
                </div>
                <span className="text-lg font-bold text-[var(--text-main)]">{group.users.size}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                  <Layout size={12} /> Mapa de Conexões (IAs / Autores)
                </h4>
                {group.totalIAs > 1 && (
                  <button 
                    onClick={() => toggleSector(group.sector)}
                    className={`text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl transition-all flex items-center gap-2 ${
                      expandedSectors.has(group.sector)
                      ? "bg-lab-cyan text-white shadow-xl shadow-lab-cyan/30 scale-105"
                      : "bg-lab-cyan/10 text-lab-cyan hover:bg-lab-cyan hover:text-white shadow-lg shadow-lab-cyan/5"
                    }`}
                  >
                    {expandedSectors.has(group.sector) ? "Recolher" : `Ver ${group.totalIAs} Ferramentas`}
                    <ChevronRight size={14} className={`transition-transform duration-300 ${expandedSectors.has(group.sector) ? "rotate-90" : ""}`} />
                  </button>
                )}
              </div>

              <div className="relative group/map">
                <AnimatePresence initial={false}>
                  {(group.totalIAs === 1 || expandedSectors.has(group.sector)) && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-2">
                        {group.records.map((r, i) => (
                          <div 
                            key={i} 
                            onClick={() => setSelectedIA(r)}
                            className="flex items-center justify-between p-4 rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-transparent hover:border-lab-cyan/30 hover:bg-lab-cyan/[0.03] transition-all group/ia cursor-pointer active:scale-[0.98] hover:shadow-lg hover:shadow-lab-cyan/5"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`size-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                                r.statusAuditoria === "Aprovado" ? "bg-brand-green/10 text-brand-green" : "bg-brand-orange/10 text-brand-orange"
                              }`}>
                                {r.statusAuditoria === "Aprovado" ? "✓" : "?"}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-[var(--text-bright)] group-hover/ia:text-lab-cyan transition-colors uppercase">{r.nomeFerramenta}</div>
                                <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 min-w-0">
                                   <div className="flex items-center gap-1 truncate">
                                     <User size={10} /> {r.responsavelPreenchimento}
                                     {profiles.find(p => p.full_name === r.responsavelPreenchimento)?.role?.toLowerCase().trim() === "admin" && (
                                       <span className="p-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[7px] font-black text-amber-500 uppercase tracking-tighter shrink-0 flex items-center gap-0.5 ml-1">
                                         <ShieldCheck size={7} /> ADM
                                       </span>
                                     )}
                                   </div>
                                   {profiles.find(p => p.id === r.owner_id || p.full_name === r.responsavelPreenchimento)?.avatar_url && (
                                     <img 
                                       src={profiles.find(p => p.id === r.owner_id || p.full_name === r.responsavelPreenchimento)?.avatar_url} 
                                       alt={r.responsavelPreenchimento}
                                       className="size-4 rounded-full ml-1"
                                     />
                                   )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover/ia:opacity-100 transition-all -translate-x-2 group-hover/ia:translate-x-0 group-hover/ia:text-lab-cyan" />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {group.totalIAs > 1 && !expandedSectors.has(group.sector) && (
                  <div 
                    onClick={() => toggleSector(group.sector)}
                    className="relative cursor-pointer group/stack mt-2"
                  >
                    {/* Visual Stack Effect */}
                    <div className="absolute top-4 left-4 right-4 h-14 bg-slate-200/20 dark:bg-white/5 rounded-2xl border border-slate-200/50 -z-30 translate-y-2 scale-[0.92] blur-[0.5px]"></div>
                    <div className="absolute top-2 left-2 right-2 h-14 bg-slate-100/40 dark:bg-white/5 border border-slate-200/50 rounded-2xl -z-20 translate-y-1 scale-[0.96]"></div>
                    <div className="h-16 w-full bg-white dark:bg-white/5 rounded-2xl border-2 border-dashed border-lab-cyan/30 flex items-center justify-center gap-3 group-hover/stack:border-lab-cyan group-hover/stack:bg-lab-cyan/[0.02] transition-all">
                      <div className="size-8 rounded-lg bg-lab-cyan/10 flex items-center justify-center text-lab-cyan">
                        <Plus size={16} className="group-hover/stack:rotate-90 transition-transform" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-lab-cyan uppercase tracking-widest">Expandir Conexões</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">+{group.totalIAs} ferramentas integradas neste setor</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Modal de Detalhes da IA */}
      <AnimatePresence>
        {selectedIA && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedIA(null)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-white/10 rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Header */}
              <div className="relative pt-12 pb-8 px-10 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-green via-emerald-400 to-brand-green opacity-50"></div>
                
                <div className="absolute top-8 right-8 z-10">
                  <button 
                    onClick={() => setSelectedIA(null)}
                    className="size-12 rounded-2xl bg-emerald-50 dark:bg-white/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-white/10 transition-all hover:rotate-90 active:scale-90 shadow-sm"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                  <div className="text-center md:text-left space-y-2">
                    <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border tracking-widest ${
                        selectedIA.statusAuditoria === "Aprovado" 
                        ? "bg-brand-green/10 text-brand-green border-brand-green/20" 
                        : "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
                      }`}>
                        {selectedIA.statusAuditoria || "Pendente"}
                      </span>
                      <span className="text-[10px] text-emerald-600/60 dark:text-emerald-500/60 font-black uppercase tracking-[0.2em]">
                        {selectedIA.fornecedor}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
                      {selectedIA.nomeFerramenta}
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-white/60 max-w-md">
                      {selectedIA.descricaoAtividade.split('.')[0]}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bento Grid */}
              <div className="px-10 pb-12 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-6 rounded-[2rem] bg-emerald-50/20 dark:bg-white/[0.03] border border-emerald-100/50 dark:border-white/5 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-green">Atribuição</span>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase">Setor</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase truncate">{selectedIA.unidadeSetor}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase">Gestor</p>
                      <p className="text-sm font-black text-slate-800 dark:text-white">{selectedIA.responsavelPreenchimento}</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-[2rem] bg-emerald-50/50 dark:bg-brand-green/5 border border-emerald-100 dark:border-brand-green/20 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-green">Segurança</span>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase">LGPD</p>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{selectedIA.alinhadoLGPD === "Sim" ? "CONFORME" : "PENDENTE"}</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase">Risco</p>
                      <span className={`text-sm font-black uppercase ${selectedIA.riscoResidual === "Baixo" ? "text-brand-green" : "text-brand-orange"}`}>{selectedIA.riscoResidual}</span>
                    </div>
                  </div>

                  <div className="p-6 rounded-[2rem] bg-emerald-50/20 dark:bg-white/[0.03] border border-emerald-100/50 dark:border-white/5 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">Impacto</span>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase">Uso</p>
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase truncate block">{selectedIA.naturezaUso}</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase">Criticidade</p>
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase truncate block">{selectedIA.criticidade}</span>
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-emerald-50/30 dark:bg-white/[0.02] border border-emerald-100/30 dark:border-white/5 space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest text-brand-green">Objetivos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <p className="text-sm text-slate-600 dark:text-white/60 italic leading-relaxed">"{selectedIA.descricaoAtividade}"</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedIA.objetivos?.map((obj, i) => (
                        <div key={i} className="bg-white dark:bg-white/5 px-4 py-2 rounded-xl border border-emerald-100/40 dark:border-white/10 shadow-sm text-[10px] font-black text-slate-500 dark:text-white/40 uppercase">{obj}</div>
                      ))}
                    </div>
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
