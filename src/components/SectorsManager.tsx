/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  Plus, 
  Trash2, 
  Search, 
  Users, 
  Database, 
  AlertCircle, 
  Check, 
  X,
  Layers,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, UserProfile } from "../types";
import { getSectors, saveSectors } from "../storage";

interface SectorsProps {
  records: IARecord[];
  profiles: UserProfile[];
  onRefresh?: () => void;
}

export default function SectorsManager({ records, profiles, onRefresh }: SectorsProps) {
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSectorName, setNewSectorName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSectorsList = async () => {
    setLoading(true);
    try {
      const list = await getSectors();
      setSectors(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectorsList();
  }, []);

  const sectorsWithMetrics = useMemo(() => {
    return sectors.map(sector => {
      const sectorIAs = records.filter(r => (r.unidadeSetor || "").trim().toLowerCase() === sector.trim().toLowerCase());
      const sectorProfiles = profiles.filter(p => (p.setor || "").trim().toLowerCase() === sector.trim().toLowerCase());
      return {
        name: sector,
        iaCount: sectorIAs.length,
        userCount: sectorProfiles.length,
      };
    });
  }, [sectors, records, profiles]);

  const filteredSectors = useMemo(() => {
    return sectorsWithMetrics.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sectorsWithMetrics, searchTerm]);

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = newSectorName.trim();
    if (!name) return;

    if (sectors.some(s => s.trim().toLowerCase() === name.toLowerCase())) {
      setError("Este setor já existe.");
      return;
    }

    const updatedSectors = [...sectors, name];
    setSectors(updatedSectors);
    const ok = await saveSectors(updatedSectors);
    if (ok) {
      setSuccess(`Setor "${name}" cadastrado com sucesso!`);
      setNewSectorName("");
      if (onRefresh) onRefresh();
    } else {
      setError("Erro ao persistir o setor. Tente novamente.");
      // Rollback
      setSectors(sectors);
    }
  };

  const handleDeleteSector = async (nameToDelete: string) => {
    const hasIAs = records.some(r => (r.unidadeSetor || "").trim().toLowerCase() === nameToDelete.trim().toLowerCase());
    const hasUsers = profiles.some(p => (p.setor || "").trim().toLowerCase() === nameToDelete.trim().toLowerCase());

    if (hasIAs || hasUsers) {
      if (!window.confirm(`O setor "${nameToDelete}" possui usuários (${profiles.filter(p => (p.setor || "").trim().toLowerCase() === nameToDelete.trim().toLowerCase()).length}) ou IAs associadas. Deseja realmente excluí-lo da lista de opções de cadastro?`)) {
        return;
      }
    }

    setError(null);
    setSuccess(null);

    const updatedSectors = sectors.filter(s => s !== nameToDelete);
    setSectors(updatedSectors);
    const ok = await saveSectors(updatedSectors);
    if (ok) {
      setSuccess(`Setor "${nameToDelete}" removido.`);
      if (onRefresh) onRefresh();
    } else {
      setError("Erro ao remover o setor.");
      setSectors(sectors);
    }
  };

  return (
    <div id="sectors-manager-view" className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="relative p-10 rounded-[3rem] overflow-hidden bg-white border-2 border-[#03440c] shadow-md transition-all">
        <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 scale-110 pointer-events-none">
          <Building2 size={320} className="text-[#03440c]" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#03440c]/10 border border-[#03440c]/20 rounded-full text-[#03440c] text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <Layers size={12} /> Painel de Governança
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-950 tracking-tighter uppercase leading-[0.9] mb-6">
            Controle de <span className="text-[#03440c]">Setores</span>
          </h1>
          <p className="text-slate-700 font-bold leading-relaxed">
            Cadastre novos setores no ecossistema e gerencie a árvore departamental do Laboratório Cedro, viabilizando o monitoramento corporativo integrado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left pane: Add and statistics */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass border border-[var(--border-lab)] rounded-[32px] p-8 shadow-xl relative overflow-hidden">
            <h2 className="text-lg font-black text-[var(--text-bright)] uppercase tracking-tight mb-6 flex items-center gap-2">
              <Plus size={20} className="text-brand-green" /> Adicionar Setor
            </h2>
            
            <form onSubmit={handleAddSector} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-1">Nome do Setor</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Endocrinologia, Faturamento..."
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  className="w-full px-5 py-4 bg-black/5 dark:bg-white/5 border border-[var(--border-lab)] rounded-2xl focus:border-brand-green outline-none transition-all text-sm font-semibold placeholder:text-[var(--text-muted)]/50"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-brand-green/10 border border-brand-green/20 rounded-xl text-brand-green text-xs font-bold flex items-center gap-2">
                  <Check size={16} /> {success}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-brand-green to-lab-cyan text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg hover:shadow-lab-cyan/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                Cadastrar Setor
                <ArrowRight size={14} />
              </button>
            </form>
          </div>

          {/* Quick Statistics Card */}
          <div className="glass border border-[var(--border-lab)] rounded-[32px] p-8 shadow-md">
            <h3 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest mb-6">Módulos Administrativos</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-[var(--border-lab)]">
                <span className="text-xs font-bold text-[var(--text-muted)]">Setores Totais</span>
                <span className="text-lg font-mono font-black text-brand-green">{sectors.length.toString().padStart(2, "0")}</span>
              </div>
              <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-[var(--border-lab)]">
                <span className="text-xs font-bold text-[var(--text-muted)]">Com IAs Ativas</span>
                <span className="text-lg font-mono font-black text-lab-cyan">
                  {sectorsWithMetrics.filter(s => s.iaCount > 0).length.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-[var(--border-lab)]">
                <span className="text-xs font-bold text-[var(--text-muted)]">Sem IAs Ativas</span>
                <span className="text-lg font-mono font-black text-amber-500">
                  {sectorsWithMetrics.filter(s => s.iaCount === 0).length.toString().padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane: List with search */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 border border-[var(--border-lab)] p-2 rounded-2xl">
            <Search className="text-[var(--text-muted)] ml-3 shrink-0" size={18} />
            <input 
              type="text"
              placeholder="Pesquisar setores cadastrados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none outline-none py-2 text-sm font-semibold placeholder:text-[var(--text-muted)]/50"
            />
          </div>

          {loading ? (
            <div className="py-20 text-center text-[var(--text-muted)]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lab-cyan mx-auto mb-4"></div>
              <span>Carregando árvore departamental...</span>
            </div>
          ) : filteredSectors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredSectors.map((sec) => (
                  <motion.div
                    key={sec.name}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="glass border border-[var(--border-lab)] rounded-2xl p-6 shadow-sm hover:border-brand-green/30 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-brand-green/10 to-lab-cyan/10 border border-[var(--border-lab)] flex items-center justify-center text-brand-green">
                          <Building2 size={20} />
                        </div>
                        <button
                          onClick={() => handleDeleteSector(sec.name)}
                          className="size-8 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Excluir Setor"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <h3 className="text-base font-black text-[var(--text-bright)] uppercase tracking-tight mb-4 truncate" title={sec.name}>
                        {sec.name}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-lab)]/50">
                      <div className="flex items-center gap-2">
                        <Database size={14} className="text-lab-cyan shrink-0" />
                        <div>
                          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-0.5">Sistemas</p>
                          <p className="text-xs font-black text-[var(--text-bright)]">{sec.iaCount.toString().padStart(2, "0")} IAs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-brand-green shrink-0" />
                        <div>
                          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-0.5">Membros</p>
                          <p className="text-xs font-black text-[var(--text-bright)]">{sec.userCount.toString().padStart(2, "0")} Perfis</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-20 text-center glass border-2 border-dashed border-[var(--border-lab)] rounded-[32px]">
              <Building2 className="text-[var(--text-muted)] opacity-35 mx-auto mb-4" size={48} />
              <h4 className="text-base font-black text-[var(--text-bright)] uppercase tracking-tight mb-1">Nenhum setor encontrado</h4>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Tente buscar por outro termo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
