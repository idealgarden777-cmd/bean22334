import { supabase, send, withUser, publicUser } from "./_lib/session.js";

/* GET /api/users?q=leo  ->  find Bean IDs to start a chat with */
export default withUser(async (req, res, me) => {
  const q = String(req.query.q || "")
    .toLowerCase()
    .replace(/@bean$/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 32);

  if (q.length < 2) return send(res, 200, { users: [] });

  const { data, error } = await supabase
    .from("bean_users")
    .select("id, username, display_name, status")
    .ilike("username", `${q}%`)
    .eq("status", "active")
    .neq("id", me.id)
    .limit(10);

  if (error) throw error;
  return send(res, 200, { users: (data || []).map(publicUser) });
});
