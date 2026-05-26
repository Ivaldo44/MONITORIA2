import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { motion } from "framer-motion";
import { User, Mail, Briefcase, Building, Phone, Save, Loader2, Camera, LogOut, ShieldCheck } from "lucide-react";
import { getSectors } from "../storage";

export const UserProfileView: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    cargo: "",
    setor: "",
    contato: "",
    avatar_url: ""
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sectors, setSectors] = useState<string[]>([]);

  useEffect(() => {
    const fetchSectors = async () => {
      const list = await getSectors();
      setSectors(list);
    };
    fetchSectors();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        cargo: profile.cargo || "",
        setor: profile.setor || "",
        contato: profile.contato || "",
        avatar_url: profile.avatar_url || ""
      });
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error("Você deve selecionar uma imagem para fazer o upload.");
      }

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `user-avatars/${fileName}`;

      // Upload do arquivo para o bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Pegar a URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      setMessage({ type: "success", text: "Foto carregada! Não esqueça de salvar as alterações abaixo." });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro no upload da foto" });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...formData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      await refreshProfile();
      setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro ao atualizar perfil" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-bright)] tracking-tight">Meu Perfil</h1>
          <p className="text-[var(--text-muted)]">Gerencie suas informações no Laboratório Cedro</p>
        </div>
        <button 
          onClick={() => signOut()}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all font-medium text-sm"
        >
          <LogOut size={16} />
          Sair da Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="glass border border-[var(--border-lab)] rounded-[32px] p-8 text-center sticky top-24">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-brand-green to-lab-cyan p-1">
                <div className="w-full h-full rounded-full bg-[var(--bg-card)] overflow-hidden flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="animate-spin text-lab-cyan" size={32} />
                  ) : formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-[var(--text-muted)]" />
                  )}
                </div>
              </div>
              <label 
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-2 bg-lab-blue text-white rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer flex items-center justify-center"
              >
                <Camera size={16} />
                <input 
                  id="avatar-upload"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-bright)] mb-1">
              {formData.full_name || "Nome não definido"}
            </h2>
            {profile?.role === "admin" && (
              <div className="flex justify-center mb-3">
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck size={12} /> Administrador
                </span>
              </div>
            )}
            <p className="text-lab-cyan font-medium text-sm mb-4">
              {formData.cargo || "Cargo não definido"}
            </p>
            
            <div className="pt-6 border-t border-[var(--border-lab)] flex flex-col gap-3">
              <div className="flex items-center gap-3 text-left text-sm text-[var(--text-muted)]">
                <Mail size={14} className="shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-left text-sm text-[var(--text-muted)]">
                <Building size={14} className="shrink-0" />
                <span>{formData.setor || "Sem setor"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass border border-[var(--border-lab)] rounded-[32px] p-8 shadow-xl"
          >
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm text-[var(--text-bright)] dark:text-white font-semibold"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Cargo</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                    <input
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm text-[var(--text-bright)] dark:text-white font-semibold"
                      placeholder="Ex: Farmacêutico"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">
                    Setor
                  </label>
                  <div className="relative">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={18} />
                    {profile?.role === "admin" ? (
                      <>
                        <select
                          value={formData.setor}
                          onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                          className="w-full pl-12 pr-10 py-4 bg-black/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm appearance-none cursor-pointer text-[var(--text-bright)] font-semibold"
                        >
                          <option value="">Selecione um setor...</option>
                          {sectors.map((sec) => (
                            <option key={sec} value={sec}>{sec}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
                          <svg className="size-4 fill-current" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <input
                        type="text"
                        value={formData.setor}
                        disabled
                        className="w-full pl-12 pr-4 py-4 bg-black/5 border border-[var(--border-lab)] rounded-2xl text-sm text-[var(--text-bright)] font-semibold opacity-70 cursor-not-allowed"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Contato / Ramal</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                    <input
                      type="text"
                      value={formData.contato}
                      onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm text-[var(--text-bright)] dark:text-white font-semibold"
                      placeholder="Ex: (21) 9999-9999"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">URL da Foto (Avatar)</label>
                  <input
                    type="url"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    className="w-full px-4 py-4 bg-black/5 dark:bg-white/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm text-[var(--text-bright)] dark:text-white font-semibold"
                    placeholder="https://exemplo.com/sua-foto.jpg"
                  />
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-xl text-xs font-medium ${
                  message.type === "success" ? "bg-brand-green/10 text-brand-green" : "bg-red-500/10 text-red-500"
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-brand-green to-lab-cyan text-white font-bold rounded-2xl shadow-lg hover:shadow-lab-cyan/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Salvar Alterações</>}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
