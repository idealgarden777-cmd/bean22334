import crypto from "node:crypto";
import { supabase, send, withUser, readBody, fail, getMembership, MEDIA_BUCKET } from "./_lib/session.js";

const MAX_BYTES = 25 * 1024 * 1024;

/* POST /api/upload {conversationId, name, size, mime}
 *   -> { path, signedUrl }   then the browser PUTs the file to signedUrl */
export default withUser(
  async (req, res, me) => {
    const { conversationId, name, size, mime } = readBody(req);
    await getMembership(conversationId, me.id);
    if (!size || Number(size) > MAX_BYTES) fail(400, "Files can be up to 25 MB");

    const safe = String(name || "file")
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "_")
      .slice(-80);
    const path = `${conversationId}/${crypto.randomUUID()}_${safe}`;

    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error) throw error;

    return send(res, 200, { path, signedUrl: data.signedUrl, token: data.token, mime: mime || "application/octet-stream" });
  },
  { methods: ["POST"], limit: [40, 60], name: "upload" }
);
