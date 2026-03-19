import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NAVER_API_URL = "https://openapi.naver.com/v1/search/news.json";

interface NaverNewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

/** Extract 2-3 key search terms from title using AI */
async function extractSearchQuery(title: string, summary: string, lovableApiKey: string): Promise<string> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Extract 2-3 core Korean search keywords from the given title and summary for Naver News search. Output ONLY the keywords separated by spaces, nothing else. Focus on company names, industry terms, or key events.",
          },
          { role: "user", content: `제목: ${title}\n요약: ${summary}` },
        ],
        temperature: 0,
        max_tokens: 50,
      }),
    });

    if (!res.ok) {
      console.error("Search query extraction error:", res.status);
      // Fallback: extract Korean words from title
      return title.replace(/[^\w가-힣\s]/g, "").split(/\s+/).slice(0, 3).join(" ");
    }

    const data = await res.json();
    const query = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("Extracted search query:", query);
    return query || title.replace(/[^\w가-힣\s]/g, "").split(/\s+/).slice(0, 3).join(" ");
  } catch (e) {
    console.error("extractSearchQuery error:", e);
    return title.replace(/[^\w가-힣\s]/g, "").split(/\s+/).slice(0, 3).join(" ");
  }
}

/** Search Naver News API */
async function searchNaverNews(
  query: string,
  clientId: string,
  clientSecret: string,
  display = 10
): Promise<NaverNewsItem[]> {
  try {
    const params = new URLSearchParams({
      query,
      display: String(display),
      sort: "sim",
    });

    const res = await fetch(`${NAVER_API_URL}?${params}`, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Naver API error:", res.status, errText);
      return [];
    }

    const data = await res.json();
    console.log(`Naver search for "${query}": ${data.total} total, ${(data.items || []).length} returned`);
    return (data.items || []) as NaverNewsItem[];
  } catch (e) {
    console.error("searchNaverNews error:", e);
    return [];
  }
}

/** Find similar insights from DB using keyword/theme matching */
async function findSimilarInsights(
  supabase: any,
  insightId: string,
  userId: string,
  themes: string[],
  stocks: string[]
): Promise<{ count: number; titles: string[] }> {
  try {
    // Search for insights with overlapping themes or stocks
    const { data: allInsights, error } = await supabase
      .from("insights")
      .select("id, ai_title, themes, stocks")
      .eq("user_id", userId)
      .eq("status", "completed")
      .neq("id", insightId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !allInsights) return { count: 0, titles: [] };

    const similar: string[] = [];
    for (const ins of allInsights) {
      const insThemes = Array.isArray(ins.themes) ? ins.themes : [];
      const insStocks = Array.isArray(ins.stocks)
        ? ins.stocks.map((s: any) => s.name || "")
        : [];

      const themeOverlap = themes.filter((t) => insThemes.includes(t)).length;
      const stockOverlap = stocks.filter((s) => insStocks.includes(s)).length;

      if (themeOverlap >= 1 || stockOverlap >= 1) {
        similar.push(ins.ai_title || "");
      }
    }

    return { count: similar.length, titles: similar.slice(0, 5) };
  } catch (e) {
    console.error("findSimilarInsights error:", e);
    return { count: 0, titles: [] };
  }
}

/** Use AI to evaluate cross-verification flags based on Naver results + similar insights */
async function evaluateCrossVerification(
  originalTitle: string,
  originalSummary: string,
  naverArticles: NaverNewsItem[],
  similarCount: number,
  similarTitles: string[],
  lovableApiKey: string
): Promise<boolean[]> {
  const naverContext = naverArticles
    .slice(0, 5)
    .map((a, i) => `[${i + 1}] ${stripHtml(a.title)}: ${stripHtml(a.description)}`)
    .join("\n");

  const similarContext = similarCount > 0
    ? `\n\n기존 저장된 유사 인사이트 ${similarCount}건:\n${similarTitles.map((t, i) => `- ${t}`).join("\n")}`
    : "\n\n기존 저장된 유사 인사이트 없음";

  const prompt = `당신은 투자 정보 교차검증 전문가입니다. 원본 콘텐츠와 외부 소스를 비교하여 5개 체크리스트 항목을 평가하세요.

## 원본 콘텐츠
제목: ${originalTitle}
요약: ${originalSummary}

## 네이버 뉴스 검색 결과 (유사 기사 ${naverArticles.length}건)
${naverContext || "관련 기사 없음"}
${similarContext}

## 교차 검증 체크리스트 (부정적 조건이 해당하면 true)
q1: 최초 출처와 작성자의 신뢰도에 대해 다른 소스들의 평가가 상충하는가?
q2: 본문에 제시된 수치와 외부 팩트의 일치 여부가 불확실한가?
q3: 인과관계 비약이나 선동 표현의 심각성에 대해 해석이 갈리는가?
q4: 정보의 유효 기간이나 시세 선반영 수준에 대한 판단이 엇갈리는가?
q5: 작성자의 숨겨진 이득 여부에 대해 '순수 정보'와 '광고' 사이 판단이 갈리는가?

## 판단 기준
- 네이버 뉴스에서 유사한 내용의 기사가 3건 이상 확인되면 → 교차검증 통과 경향 (false 다수)
- 네이버 뉴스에서 1~2건만 확인되면 → 일부 항목만 통과
- 검색 결과가 거의 없거나 내용이 상충하면 → 교차검증 실패 (true 다수)
- 유사 인사이트가 많고 같은 맥락이면 → 신뢰도 상승 (false 경향)
- 관련 기사가 0건이면 q1~q5 모두 true로 판정

STRICTLY respond with ONLY a JSON array of 5 booleans, e.g. [true, false, true, false, true]`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a cross-verification evaluator. Respond ONLY with a JSON array of 5 booleans." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      console.error("Cross-verify AI error:", res.status, await res.text());
      return [true, true, true, true, true];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      const flags = JSON.parse(match[0]);
      if (Array.isArray(flags) && flags.length === 5) {
        return flags.map((f: any) => Boolean(f));
      }
    }

    console.error("Failed to parse cross-verify response:", content);
    return [true, true, true, true, true];
  } catch (e) {
    console.error("evaluateCrossVerification error:", e);
    return [true, true, true, true, true];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { insightId, title, summary, content, userId, themes, stocks } = await req.json();

    if (!insightId || !title) {
      return new Response(
        JSON.stringify({ error: "insightId and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const naverClientId = Deno.env.get("NAVER_CLIENT_ID");
    const naverClientSecret = Deno.env.get("NAVER_CLIENT_SECRET");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!naverClientId) throw new Error("NAVER_CLIENT_ID is not configured");
    if (!naverClientSecret) throw new Error("NAVER_CLIENT_SECRET is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Extract optimized search query from title
    const searchQuery = await extractSearchQuery(title, summary || "", lovableApiKey);

    // 2. Search Naver News for related articles
    const naverArticles = await searchNaverNews(searchQuery, naverClientId, naverClientSecret);
    console.log(`Naver News: ${naverArticles.length} articles found`);

    // 3. Find similar insights from DB using keyword/theme matching
    const stockNames = Array.isArray(stocks) ? stocks.map((s: any) => s.name || s) : [];
    const themeList = Array.isArray(themes) ? themes : [];
    const similar = await findSimilarInsights(supabase, insightId, userId || "", themeList, stockNames);
    console.log(`Similar insights: ${similar.count} found`);

    // 4. Evaluate cross-verification using AI with real external data
    const crossVerifyFlags = await evaluateCrossVerification(
      title,
      summary || "",
      naverArticles,
      similar.count,
      similar.titles,
      lovableApiKey
    );

    console.log("Cross-verification flags:", crossVerifyFlags);

    return new Response(
      JSON.stringify({
        success: true,
        flags: crossVerifyFlags,
        naver_count: naverArticles.length,
        similar_count: similar.count,
        search_query: searchQuery,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cross-verify error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
