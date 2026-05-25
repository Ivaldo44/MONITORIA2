import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Building } from "lucide-react";
import { getSectors } from "../storage";

interface AuthProps {
  onAuthSuccess?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [setor, setSetor] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSectors().then(setSectors);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: cleanEmail, 
          password: cleanPassword 
        });
        if (error) throw error;
        if (onAuthSuccess) onAuthSuccess();
      } else {
        if (!setor) {
          setMessage({ type: "error", text: "Por favor, selecione seu setor." });
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({ 
          email: cleanEmail, 
          password: cleanPassword,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        
        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({ 
              id: data.user.id, 
              full_name: fullName,
              setor: setor,
              cargo: "Colaborador"
            });
          
          if (profileError) console.error("Erro ao criar perfil:", profileError);
          setMessage({ type: "success", text: "Cadastro realizado! Faça login para continuar." });
          setMode("login");
        }
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro ao processar solicitação" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-lab-cyan/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-brand-green/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass border border-[var(--border-lab)] p-8 rounded-[32px] shadow-2xl relative z-10"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Cedro IA Logo" 
              className="h-32 w-auto [filter:var(--logo-filter)]" 
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                  <input
                    type="text"
                    placeholder="Nome Completo"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-black/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm"
                  />
                </div>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={18} />
                  <select
                    required
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-black/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm appearance-none"
                  >
                    <option value="">Selecione seu setor *</option>
                    {sectors.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input
              type="email"
              placeholder="E-mail profissional"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-black/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input
              type="password"
              placeholder="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-black/5 border border-[var(--border-lab)] rounded-2xl focus:border-lab-cyan outline-none transition-all text-sm"
            />
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
            className="w-full py-4 bg-gradient-to-r from-brand-green to-lab-cyan hover:shadow-lg hover:shadow-lab-cyan/20 text-white font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {mode === "login" ? "Entrar na plataforma" : "Criar minha conta"}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[var(--text-muted)] text-sm">
            {mode === "login" ? "Ainda não tem acesso?" : "Já possui uma conta?"}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
              className="ml-2 text-lab-cyan font-bold hover:underline"
            >
              {mode === "login" ? "Cadastre-se" : "Faça Login"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
