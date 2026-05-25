import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Lazy-initialized Supabase clients to prevent startup crashes if keys are not set
let supabaseClient: any = null;
let supabaseAdminClient: any = null;

function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase URL or Anon Key is missing in server environment");
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase URL or Service Role Key is missing in admin server environment");
    }
    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminClient;
}

// API Routes
const router = express.Router();

router.post("/admin/update-role", async (req, res) => {
  const { userId, newRole } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    
    // Lazy initialized supabase client
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || requesterProfile?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: You are not an admin" });
    }

    // Lazy initialized supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true, profile: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

router.post("/admin/delete-user", async (req, res) => {
  const { userId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: requester } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (requester?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Limpar mensagens vinculadas
    await supabaseAdmin.from("messages").delete().eq("sender_id", userId);
    await supabaseAdmin.from("messages").delete().eq("recipient_id", userId);

    // 2. Limpar referências
    await supabaseAdmin.from("ia_records").update({ authorized_by: null }).eq("authorized_by", userId);
    await supabaseAdmin.from("ia_records").update({ owner_id: null }).eq("owner_id", userId);
    await supabaseAdmin.from("profiles").update({ authorized_by: null }).eq("authorized_by", userId);

    // 3. Storage
    try {
      await supabaseAdmin.rpc("delete_user_storage_objects", { user_id: userId });
    } catch (e) {
      // @ts-ignore
      await supabaseAdmin.from("storage.objects").delete().eq("owner", userId).catch(() => {});
    }

    // 4. Deletar perfil
    const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profileDeleteError) {
      return res.status(500).json({ error: `Erro ao apagar perfil: ${profileDeleteError.message}` });
    }

    // 5. Deletar do Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
       return res.status(500).json({ 
         error: `Erro ao apagar conta no Auth: ${authDeleteError.message}`
       });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Routing mapping
app.use("/api", router);
app.use("/.netlify/functions/api", router);

export { app };
