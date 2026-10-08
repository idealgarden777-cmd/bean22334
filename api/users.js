import { supabase, send, withUser } from "./_lib/session.js";
import { loadUsers } from "./_lib/chat.js";

/* GET /api/users?q=leo -> find Bean IDs */
export default withUser(async (req, res, me) => {
  const q = String(req.query.q || "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/@bean$/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 32);
  if (q.length < 2) return send(res, 200, { users: [] });

  const { data, error } = await supabase
    .from("bean_users")
    .select("id")
    .or(`username.ilike.${q}%,display_name.ilike.${q}%`)
    .eq("status", "active")
    .neq("id", me.id)
    .limit(12);
  if (error) throw error;

  const users = await loadUsers((data || []).map((u) => u.id));
  return send(res, 200, { users: [...users.values()] });
});
