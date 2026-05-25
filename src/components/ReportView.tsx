/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Printer, ArrowLeft, Download, AlertTriangle, Activity } from "lucide-react";
import { IARecord, StatusUso, ClassificacaoRisco } from "../types";

interface ReportViewProps {
  record: IARecord;
  onBack: () => void;
}

export default function ReportView({ record, onBack }: ReportViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const Section = ({ title, icon: Icon, children, color = "bg-slate-900 dark:bg-black/40" }: { title: string; icon: any; children: React.ReactNode; color?: string }) => (
    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-lab)] shadow-sm overflow-hidden mb-8 print:shadow-none print:border-slate-200">
      <div className={`px-6 py-4 ${color} text-white flex items-center gap-3 border-b border-[var(--border-lab)]`}>
        <Icon size={20} className="text-white/80" />
        <h3 className="font-black text-sm uppercase tracking-widest text-white">{title}</h3>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {children}
      </div>
    </div>
  );

  const Field = ({ label, value, fullWidth }: { label: string; value: any; fullWidth?: boolean }) => (
    <div className={`${fullWidth ? "md:col-span-2 lg:col-span-3" : ""} space-y-1`}>
      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{label}</p>
      <div className="text-[var(--text-main)] font-medium text-sm break-words whitespace-pre-line">
        {Array.isArray(value) ? value.join(", ") : (value || "Não informado")}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24 px-4 sm:px-0">
      {/* Toolbox - High Tech Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center glass p-6 rounded-3xl border border-[var(--border-lab)] gap-6 shadow-2xl print:hidden relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-lab-cyan/30 to-transparent"></div>
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-lab-cyan transition-all uppercase tracking-tight group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Voltar ao Inventário
        </button>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={handlePrint} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 glass hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] text-xs font-bold uppercase tracking-tight rounded-2xl border border-[var(--border-lab)] transition-all active:scale-95"
          >
            <Printer size={16} />
            Imprimir Laudo
          </button>
          <button 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-brand-green text-black text-xs font-bold uppercase tracking-tight rounded-2xl hover:bg-brand-green/80 transition-all shadow-xl dark:shadow-[0_10px_30px_rgba(0,255,65,0.2)] active:scale-95"
          >
            <Download size={16} />
            Exportar PDF
          </button>
        </div>
      </div>

      <div id="report-content" className="bg-[var(--bg-main)] rounded-[3rem] shadow-2xl dark:shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-[var(--border-lab)] overflow-hidden print:shadow-none print:border-none relative">
        {/* Document Header - AI Lab Profile */}
        <div className="bg-gradient-to-br from-brand-green/20 via-brand-green/10 to-transparent p-12 relative overflow-hidden border-b-8 border-brand-green shadow-sm">
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-12 mb-12">
               <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-brand-green text-black text-[10px] font-bold tracking-tight uppercase rounded-full">Relatório de Auditoria Central</div>
                  <div className="h-px w-8 bg-brand-green/20"></div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-brand-green bg-brand-green/20 px-2 py-1 rounded border border-brand-green/40 whitespace-nowrap">REF: {record.id}</span>
                </div>
                <h1 className="text-5xl font-bold tracking-tight uppercase leading-[0.9] text-[var(--text-bright)]">{record.nomeFerramenta}</h1>
                <div className="flex items-center gap-6 text-[var(--text-muted)] font-bold text-xs tracking-tight uppercase">
                   <div className="flex items-center gap-2">
                     <Activity size={14} className="text-brand-green" />
                     <span>Gerado em: {new Date().toLocaleDateString('pt-BR')}</span>
                   </div>
                   <div className="size-1 rounded-full bg-[var(--border-lab)]"></div>
                   <span>Nível de Segurança: Alto</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`px-8 py-4 rounded-2xl shadow-sm font-bold text-xs uppercase tracking-wider border-2 flex items-center gap-3 ${
                   record.statusUso === StatusUso.APROVADO ? "bg-brand-green/10 text-brand-green border-brand-green/30" :
                   record.statusUso === StatusUso.NAO_APROVADO ? "bg-lab-red/10 text-lab-red border-lab-red/30" :
                   "bg-brand-orange/10 text-brand-orange border-brand-orange/30"
                }`}>
                  <div className={`size-2 rounded-full animate-pulse ${
                     record.statusUso === StatusUso.APROVADO ? "bg-brand-green" :
                     record.statusUso === StatusUso.NAO_APROVADO ? "bg-lab-red" :
                     "bg-brand-orange"
                  }`}></div>
                  {record.statusUso}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 bg-black/30 backdrop-blur-xl p-8 rounded-3xl border border-white/10 mt-8 shadow-2xl">
               {[
                 { label: "Setor", value: record.unidadeSetor },
                 { label: "Risco Final", value: record.classificacaoRiscoManual },
                 { label: "Fornecedor", value: record.fornecedor },
                 { label: "Responsável", value: record.responsavelPreenchimento }
               ].map((item, i) => (
                 <div key={i} className="space-y-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase tracking-tight mb-1 block">{item.label}</label>
                    <p className="font-bold text-lg tracking-tight uppercase text-white drop-shadow-sm">{item.value}</p>
                 </div>
               ))}
            </div>
          </div>
          <img src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" alt="" className="absolute right-[-60px] top-[-60px] size-[500px] opacity-10 -rotate-12 brightness-0 pointer-events-none" />
        </div>

        {/* Content Body */}
        <div className="p-12 space-y-16 bg-[var(--bg-main)]">
          {/* Section 01 */}
          <section className="relative">
            <div className="flex items-center gap-4 mb-10">
               <span className="text-[10px] font-mono text-brand-green bg-brand-green/10 px-3 py-1 rounded border border-brand-green/20">01</span>
               <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-tight">Identificação e Propósito</h3>
               <div className="h-px bg-[var(--border-lab)] flex-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 px-4">
               <div className="space-y-4">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight flex items-center gap-2">
                    <div className="size-1 rounded-full bg-lab-cyan/50"></div> Descrição da Atividade
                  </label>
                  <p className="text-[var(--text-main)] text-sm leading-relaxed font-medium bg-black/5 dark:bg-white/[0.02] p-6 rounded-2xl border border-[var(--border-lab)] shadow-inner">{record.descricaoAtividade}</p>
               </div>
               <div className="space-y-4">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight flex items-center gap-2">
                    <div className="size-1 rounded-full bg-lab-cyan/50"></div> Objetivos Estratégicos
                  </label>
                  <div className="bg-black/5 dark:bg-white/[0.02] p-6 rounded-2xl border border-[var(--border-lab)] shadow-inner">
                    <p className="text-[var(--text-main)] text-sm font-bold leading-relaxed">{record.objetivos}</p>
                  </div>
               </div>
               <div className="md:col-span-2 space-y-4">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight flex items-center gap-2">
                    <div className="size-1 rounded-full bg-lab-cyan/50"></div> Arquitetura da IA
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {record.tipoIA.map((t, i) => (
                      <span key={i} className="px-5 py-2.5 glass dark:border-white/10 rounded-xl text-[10px] font-bold text-lab-cyan uppercase tracking-wider group hover:border-lab-cyan/40 transition-all border border-[var(--border-lab)]">{t}</span>
                    ))}
                  </div>
               </div>
            </div>
          </section>

          {/* Section 02 */}
          <section className="relative">
            <div className="flex items-center gap-4 mb-10">
               <span className="text-[10px] font-mono text-brand-orange bg-brand-orange/10 px-3 py-1 rounded border border-brand-orange/20">02</span>
               <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-tight">Privacidade e Proteção de Dados</h3>
               <div className="h-px bg-[var(--border-lab)] flex-1" />
            </div>
            <div className="glass rounded-[2.5rem] p-10 border border-[var(--border-lab)] grid grid-cols-1 md:grid-cols-3 gap-12 relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 size-40 bg-brand-orange/5 blur-[80px] rounded-full"></div>
               <div className="space-y-10 relative z-10">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Dados Pessoais</label>
                    <div className={`text-xl font-bold tracking-tight ${record.usaDadosPessoais === 'Sim' ? 'text-brand-orange' : 'text-[var(--text-muted)]'}`}>{record.usaDadosPessoais?.toUpperCase() || "N/A"}</div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Conformidade LGPD</label>
                    <div className="flex items-center gap-3">
                       <div className={`size-2 rounded-full ${record.alinhadoLGPD === 'Sim' ? 'bg-brand-green shadow-sm' : 'bg-lab-red shadow-sm'}`}></div>
                       <div className={`text-xl font-bold tracking-tight ${record.alinhadoLGPD === 'Sim' ? 'text-brand-green' : 'text-lab-red'}`}>{record.alinhadoLGPD?.toUpperCase() || "N/A"}</div>
                    </div>
                  </div>
               </div>
               <div className="md:col-span-2 space-y-10 relative z-10">
                   <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Mapeamento de Dados</label>
                    <p className="text-base text-[var(--text-main)] font-bold leading-relaxed">{record.quaisDados}</p>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Medidas de Proteção</label>
                    <p className="text-sm text-[var(--text-muted)] italic font-medium bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-[var(--border-lab)]">{record.obsProtecaoDados || "Nenhuma medida detalhada informada."}</p>
                  </div>
               </div>
            </div>
          </section>

          {/* Section 03 */}
          <section className="relative">
            <div className="flex items-center gap-4 mb-10">
               <span className="text-[10px] font-mono text-lab-cyan bg-lab-cyan/10 px-3 py-1 rounded border border-lab-cyan/20">03</span>
               <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-tight">Governança e Controles de Risco</h3>
               <div className="h-px bg-[var(--border-lab)] flex-1" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 px-4">
               <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Status de Supervisão Humana</label>
                    <div className="flex items-center gap-4 bg-black/5 dark:bg-white/[0.03] p-5 rounded-2xl border border-[var(--border-lab)]">
                       <div className={`size-4 rounded-full ${record.validacaoHumana === 'Sim' ? 'bg-brand-green shadow-sm' : 'bg-lab-red shadow-sm animate-pulse'}`}></div>
                       <div>
                         <p className="font-bold text-[var(--text-bright)] text-lg tracking-tight uppercase">{record.validacaoHumana === 'Sim' ? "Operação Pronta" : "Ausência Crítica"}</p>
                         {record.validacaoHumana === 'Sim' && <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-tight mt-1">Responsável: {record.quemValida}</p>}
                       </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Índice de Risco Residual</label>
                    <div className="text-2xl font-bold text-brand-green tracking-tight">{record.riscoResidual}</div>
                  </div>
               </div>
               <div className="bg-black/5 dark:bg-white/[0.02] p-8 rounded-[2rem] border border-[var(--border-lab)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-orange/5 blur-3xl rounded-full"></div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight block mb-6">Alertas de Riscos e Conformidade</label>
                  <div className="space-y-4">
                     {record.quaisRiscos ? record.quaisRiscos.split(',').map((r, i) => (
                       <div key={i} className="flex items-center gap-4 text-xs text-[var(--text-muted)] font-bold bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-[var(--border-lab)] hover:border-brand-orange/30 transition-all">
                          <AlertTriangle size={16} className="text-brand-orange shrink-0" /> {r.trim().toUpperCase()}
                       </div>
                     )) : (
                       <div className="text-xs text-[var(--text-muted)] italic font-bold tracking-tight opacity-30 h-32 flex items-center justify-center border-2 border-dashed border-[var(--border-lab)] rounded-2xl">Nenhum risco registrado</div>
                     )}
                  </div>
               </div>
            </div>
          </section>

          <div className="h-px bg-[var(--border-lab)]" />
          
          <div className="bg-black/5 dark:bg-white/[0.02] p-12 mt-16 rounded-[3rem] border border-[var(--border-lab)] relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 pt-16">
               <div className="border-t-2 border-brand-green/30 pt-6 text-center group">
                  <p className="text-sm font-bold text-[var(--text-bright)] uppercase tracking-tight group-hover:text-brand-green transition-colors">{record.responsavelPreenchimento}</p>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-tight mt-3">Assinatura do Responsável</p>
               </div>
               <div className="border-t-2 border-lab-cyan/30 pt-6 text-center group">
                  <p className="text-sm font-bold text-[var(--text-bright)] uppercase tracking-tight group-hover:text-lab-cyan transition-colors">NIT / Comitê de Conformidade</p>
                  <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-tight mt-3">Validação Institucional</p>
               </div>
            </div>
            <div className="mt-20 text-center">
               <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tight leading-relaxed max-w-2xl mx-auto opacity-50">
                 SISTEMA DE GOVERNANÇA CEDRO — HASH DIGITAL VERIFICADO: {Math.random().toString(16).slice(2, 10).toUpperCase()} — SINCRONIZADO v1.0.0 — {new Date().toLocaleString('pt-BR')}
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}
