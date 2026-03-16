import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StockChange {
  name: string;
  changePercent: number;
}

async function fetchStockPrice(stockName: string): Promise<StockChange | null> {
  try {
    const searchUrl = `https://m.stock.naver.com/api/search/all?query=${encodeURIComponent(stockName)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const searchData = await searchRes.json();

    const items = searchData?.result?.d || searchData?.result?.stock || [];
    const item = Array.isArray(items) && items.length > 0 ? items[0] : null;

    if (!item) {
      // Try alternative API structure
      const stocks = searchData?.stocks || [];
      if (stocks.length === 0) return null;
      const stock = stocks[0];
      return {
        name: stock.stockName || stockName,
        changePercent: parseFloat(stock.fluctuationsRatio || "0"),
      };
    }

    const code = item.cd || item.code || item.stockCode;
    if (!code) return null;

    // Fetch current price data
    const priceUrl = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const priceRes = await fetch(priceUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const priceData = await priceRes.json();

    const changePercent = parseFloat(
      priceData?.fluctuationsRatio || priceData?.compareToPreviousClosePrice?.ratio || "0"
    );

    return {
      name: priceData?.stockName || stockName,
      changePercent,
    };
  } catch (e) {
    console.error(`Failed to fetch price for ${stockName}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Get user's threshold setting from profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("stock_alert_threshold")
      .eq("user_id", userId)
      .single();

    const THRESHOLD = profileData?.stock_alert_threshold ?? 3;

    // Get all unique stocks from user's insights
    const { data: insights } = await supabase
      .from("insights")
      .select("id, ai_title, stocks")
      .not("stocks", "is", null);

    if (!insights || insights.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No stocks to monitor", notifications: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect unique stock names and map to insights
    const stockInsightMap = new Map<string, { insightId: string; title: string }[]>();
    for (const insight of insights) {
      const stocks = (insight.stocks as string[]) || [];
      for (const stock of stocks) {
        if (!stockInsightMap.has(stock)) stockInsightMap.set(stock, []);
        stockInsightMap.get(stock)!.push({ insightId: insight.id, title: insight.ai_title || "" });
      }
    }

    const THRESHOLD = 3; // percentage change threshold
    const significantChanges: { stock: StockChange; insights: { insightId: string; title: string }[] }[] = [];

    // Check each stock (limit to first 10 to avoid rate limiting)
    const stockNames = Array.from(stockInsightMap.keys()).slice(0, 10);
    for (const stockName of stockNames) {
      const result = await fetchStockPrice(stockName);
      if (result && Math.abs(result.changePercent) >= THRESHOLD) {
        significantChanges.push({
          stock: result,
          insights: stockInsightMap.get(stockName)!,
        });
      }
    }

    // Create notifications for significant changes
    let notificationCount = 0;
    if (significantChanges.length > 0) {
      const stockChanges = significantChanges.map((c) => ({
        name: c.stock.name,
        changePercent: c.stock.changePercent,
      }));

      const changeMessages = stockChanges
        .map((s) => `${s.name} ${s.changePercent > 0 ? "+" : ""}${s.changePercent.toFixed(1)}% ${s.changePercent > 0 ? "상승" : "하락"}!!`)
        .join("\n");

      // Pick the first related insight
      const relatedInsight = significantChanges[0].insights[0];

      const { error: insertError } = await supabase.from("notifications").insert({
        user_id: userId,
        insight_id: relatedInsight.insightId,
        title: "저장해 놓으신 기사와 관련된 종목의 변동사항이 감지되었어요",
        message: changeMessages,
        stock_changes: stockChanges,
      });

      if (insertError) {
        console.error("Failed to insert notification:", insertError);
      } else {
        notificationCount = 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkedStocks: stockNames.length,
        significantChanges: significantChanges.length,
        notifications: notificationCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
