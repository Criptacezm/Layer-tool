import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function getDmParticipantIdsFromChannelId(channelId: string): string[] {
  const prefix = "dm-";
  if (!channelId || !channelId.toLowerCase().startsWith(prefix)) return [];
  const rest = channelId.substring(prefix.length);
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const matches = rest.match(uuidRegex);
  return matches ? matches.map((id) => id.toLowerCase()) : [];
}

function getDmChecklistId(channelId: string): string | null {
  const ids = getDmParticipantIdsFromChannelId(channelId);
  if (ids.length < 1) return null;
  const sorted = Array.from(new Set(ids)).sort();
  return `dm:${sorted.join(":")}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const channelId = String(body?.channelId || "").trim();

    if (!channelId) {
      return new Response(JSON.stringify({ error: "Missing channelId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const participants = getDmParticipantIdsFromChannelId(channelId);
    if (participants.length === 0 || !participants.includes(user.id.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteMessagesError } = await supabase
      .from("team_chat_messages")
      .delete()
      .eq("channel_id", channelId)
      .eq("channel_type", "dm");

    if (deleteMessagesError) {
      return new Response(JSON.stringify({ error: deleteMessagesError.message || "Failed to delete messages" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checklistId = getDmChecklistId(channelId);
    if (checklistId) {
      const { error: deleteChecklistError } = await supabase
        .from("dm_checklists")
        .delete()
        .eq("checklist_id", checklistId);

      if (deleteChecklistError) {
        return new Response(JSON.stringify({ error: deleteChecklistError.message || "Failed to delete checklist" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
