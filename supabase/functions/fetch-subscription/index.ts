import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active subscriptions
    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fetched = 0;

    for (const sub of subscriptions) {
      try {
        // Fetch the source URL
        const pageResponse = await fetch(sub.source_url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; InsightBot/1.0)" },
        });
        const html = await pageResponse.text();

        // Extract article links from the page
        const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
        const links: string[] = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null && links.length < 5) {
          const link = match[1];
          // Filter for article-like URLs (not static assets)
          if (
            !link.includes(".css") &&
            !link.includes(".js") &&
            !link.includes(".png") &&
            !link.includes(".jpg") &&
            link.includes(sub.source_domain || "")
          ) {
            links.push(link);
          }
        }

        // Check which links are already saved
        const { data: existing } = await supabase
          .from("insights")
          .select("url")
          .eq("user_id", sub.user_id)
          .in("url", links);

        const existingUrls = new Set((existing || []).map((e: any) => e.url));
        const newLinks = links.filter((l) => !existingUrls.has(l)).slice(0, 3);

        for (const link of newLinks) {
          let domain = "";
          try { domain = new URL(link).hostname.replace("www.", ""); } catch {}

          const { data: insight } = await supabase
            .from("insights")
            .insert({
              user_id: sub.user_id,
              url: link,
              status: "processing",
              source_domain: domain,
              favicon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            })
            .select()
            .single();

          if (insight) {
            // Trigger analysis
            const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-insight`;
            fetch(analyzeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({ insightId: insight.id, url: link }),
            }).catch(console.error);

            fetched++;
          }
        }

        // Update last_fetched_at
        await supabase
          .from("subscriptions")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (subError) {
        console.error(`Error processing subscription ${sub.id}:`, subError);
      }
    }

    return new Response(JSON.stringify({ success: true, fetched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-subscription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
