import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !authorization) {
    return reply({ error: "Configuração ou sessão ausente." }, 500);
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return reply({ error: "Sessão inválida." }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminRow, error: adminError } = await admin
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !adminRow) return reply({ error: "Apenas administradores podem excluir contas." }, 403);

  let userId: string;
  try {
    const body = await req.json();
    userId = String(body.userId || "");
  } catch {
    return reply({ error: "Pedido inválido." }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return reply({ error: "ID de conta inválido." }, 400);
  }
  if (userId === user.id) return reply({ error: "Não é possível excluir a própria conta admin." }, 400);

  const { data: targetAdmin } = await admin
    .from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (targetAdmin) return reply({ error: "Contas de administrador não podem ser excluídas por aqui." }, 403);

  // As fanarts são guardadas em uma pasta com o ID do autor. Remova os
  // arquivos antes da conta Auth, pois o Storage bloqueia usuários com arquivos.
  const paths: string[] = [];
  async function collect(prefix: string) {
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from("fanarts").list(prefix, { limit: 1000, offset });
      if (error) throw error;
      if (!data?.length) break;
      for (const item of data) {
        const path = `${prefix}/${item.name}`;
        if (item.id) paths.push(path);
        else await collect(path);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  try {
    await collect(userId);
    if (paths.length) {
      const { error } = await admin.storage.from("fanarts").remove(paths);
      if (error) return reply({ error: `Não foi possível remover as fanarts: ${error.message}` }, 500);
    }

    const { error: votesError } = await admin.from("votos").delete().eq("user_id", userId);
    if (votesError) throw votesError;
    const { error: artError } = await admin.from("fanarts").delete().eq("user_id", userId);
    if (artError) throw artError;
    const { error: scoreError } = await admin.from("placar").delete().eq("user_id", userId);
    if (scoreError) throw scoreError;
    const { error: accountError } = await admin.from("contas").delete().eq("user_id", userId);
    if (accountError) throw accountError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return reply({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return reply({ error: message }, 500);
  }
});
