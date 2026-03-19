const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StockInput {
  name: string;
  code?: string;
}

interface StockPrice {
  name: string;
  code: string;
  price: number;
  changePercent: number;
  changePrice: number;
  currency: string;
  marketStatus: string;
}

async function fetchPrice(stock: StockInput): Promise<StockPrice | null> {
  try {
    let code = stock.code;

    // If no code, search by name
    if (!code) {
      const searchUrl = `https://m.stock.naver.com/api/search/all?query=${encodeURIComponent(stock.name)}`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const searchData = await searchRes.json();
      const items = searchData?.result?.d || searchData?.result?.stock || [];
      const item = Array.isArray(items) && items.length > 0 ? items[0] : null;
      if (!item) {
        const stocks = searchData?.stocks || [];
        if (stocks.length > 0) code = stocks[0].code || stocks[0].stockCode;
      } else {
        code = item.cd || item.code || item.stockCode;
      }
    }

    if (!code) return null;

    // Determine if domestic or overseas
    const isDomestic = /^\d{6}$/.test(code);

    const priceUrl = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const priceRes = await fetch(priceUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!priceRes.ok) return null;
    const data = await priceRes.json();

    // Helper to strip commas from price strings
    const parseNum = (v: string | undefined | null) => parseFloat((v || "0").replace(/,/g, ""));

    // Use after-market price if available and market is closed
    const overMarket = data?.overMarketPriceInfo;
    const useOverMarket = overMarket && overMarket.overMarketStatus === "OPEN";

    const currentPrice = useOverMarket
      ? parseNum(overMarket.overPrice)
      : parseNum(data?.closePrice);
    const changePercent = useOverMarket
      ? parseFloat(overMarket.fluctuationsRatio || "0")
      : parseFloat(data?.fluctuationsRatio || "0");
    const changePrice = useOverMarket
      ? parseNum(overMarket.compareToPreviousClosePrice)
      : parseNum(data?.compareToPreviousClosePrice);

    // Determine currency
    const currency = data?.currencyType === "USD" || !isDomestic ? "$" : "원";

    return {
      name: data?.stockName || stock.name,
      code: code,
      price: currentPrice,
      changePercent,
      changePrice,
      currency,
      marketStatus: useOverMarket ? "AFTER_MARKET" : (data?.marketStatus || "CLOSE"),
    };
  } catch (e) {
    console.error(`Failed to fetch price for ${stock.name}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stocks } = (await req.json()) as { stocks: StockInput[] };

    if (!stocks || stocks.length === 0) {
      return new Response(
        JSON.stringify({ prices: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all prices in parallel (limit to 10)
    const limited = stocks.slice(0, 10);
    const results = await Promise.all(limited.map(fetchPrice));

    const prices = results.filter(Boolean);

    return new Response(JSON.stringify({ prices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
