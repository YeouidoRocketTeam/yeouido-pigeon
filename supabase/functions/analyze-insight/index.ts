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
    const { insightId, url } = await req.json();

    if (!insightId || !url) {
      return new Response(
        JSON.stringify({ error: "insightId and url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the URL content
    let pageContent = "";
    let pageTitle = "";
    try {
      const pageResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; InsightBot/1.0)",
        },
      });
      const html = await pageResponse.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      pageTitle = titleMatch ? titleMatch[1].trim() : "";

      // Extract text content (simple approach)
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } catch (fetchError) {
      console.error("Error fetching URL:", fetchError);
      await supabase
        .from("insights")
        .update({
          status: "error",
          error_message: "URL을 가져올 수 없습니다.",
          original_title: url,
        })
        .eq("id", insightId);
      return new Response(
        JSON.stringify({ error: "Failed to fetch URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI to analyze the content
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an investment content analyst. Analyze the given article/content and extract investment-relevant information. Respond ONLY with the tool call.`,
          },
          {
            role: "user",
            content: `Analyze this investment-related content:\n\nURL: ${url}\nTitle: ${pageTitle}\n\nContent:\n${pageContent}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_investment_content",
              description: "Extract investment insights from content",
              parameters: {
                type: "object",
                properties: {
                  ai_title: {
                    type: "string",
                    description: "A concise, insightful Korean title summarizing the investment relevance (max 60 chars)",
                  },
                  ai_summary: {
                    type: "string",
                    description: "A comprehensive Korean summary of the investment insights (2-4 sentences)",
                  },
                  source_type: {
                    type: "string",
                    enum: ["news", "report", "youtube", "sns", "community", "other"],
                    description: "Type of source content",
                  },
                  reliability_score: {
                    type: "integer",
                    description: "Reliability score 1-5 (5=most reliable, e.g. official news/reports=4-5, youtube=3, sns/community=1-2)",
                  },
                  themes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Investment themes in Korean (e.g. AI 반도체, 전기차, 바이오). Max 5 themes.",
                  },
                  stocks: {
                    type: "array",
                    items: { type: "string" },
                    description: "Related stock names or tickers mentioned (e.g. NVIDIA, 삼성전자, TSMC). Max 5 stocks.",
                  },
                },
                required: ["ai_title", "ai_summary", "source_type", "reliability_score", "themes", "stocks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_investment_content" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        await supabase.from("insights").update({
          status: "error",
          error_message: "요청 한도 초과. 잠시 후 다시 시도해주세요.",
          original_title: pageTitle,
        }).eq("id", insightId);
        return new Response(
          JSON.stringify({ error: "Rate limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (aiResponse.status === 402) {
        await supabase.from("insights").update({
          status: "error",
          error_message: "AI 크레딧이 부족합니다.",
          original_title: pageTitle,
        }).eq("id", insightId);
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Update insight with AI analysis
    await supabase
      .from("insights")
      .update({
        original_title: pageTitle,
        ai_title: analysis.ai_title,
        ai_summary: analysis.ai_summary,
        source_type: analysis.source_type,
        reliability_score: analysis.reliability_score,
        themes: analysis.themes,
        stocks: analysis.stocks,
        status: "completed",
      })
      .eq("id", insightId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-insight error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
