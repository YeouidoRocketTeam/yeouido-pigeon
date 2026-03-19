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

/** Strip HTML tags from Naver API response */
function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

/** Generate embedding via Lovable AI gateway (Gemini embedding) */
async function generateEmbedding(text: string, lovableApiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/text-embedding-004",
        input: text.slice(0, 2000),
      }),
    });

    if (!res.ok) {
      console.error("Embedding API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("generateEmbedding error:", e);
    return null;
  }
}

/** Search Naver News API for related articles */
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
      sort: "sim", // relevance
    });

    const res = await fetch(`${NAVER_API_URL}?${params}`, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!res.ok) {
      console.error("Naver API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.items || []) as NaverNewsItem[];
  } catch (e) {
    console.error("searchNaverNews error:", e);
    return [];
  }
}

/** Use AI to compare original content with external sources and produce cross-verification flags */
async function evaluateCrossVerification(
  originalTitle: string,
  originalSummary: string,
  naverArticles: NaverNewsItem[],
  similarInsights: { insight_id: string; similarity: number }[],
  lovableApiKey: string
): Promise<boolean[]> {
  const naverContext = naverArticles
    .slice(0, 5)
    .map((a, i) => `[${i + 1}] ${stripHtml(a.title)}: ${stripHtml(a.description)}`)
    .join("\n");

  const vectorContext = similarInsights.length > 0
    ? `\n\n기존 저장된 유사 인사이트 ${similarInsights.length}건 발견 (유사도: ${similarInsights.map(s => (s.similarity * 100).toFixed(0) + "%").join(", ")})`
    : "\n\n기존 저장된 유사 인사이트 없음";

  const prompt = `당신은 투자 정보 교차검증 전문가입니다. 원본 콘텐츠와 외부 소스를 비교하여 5개 체크리스트 항목을 평가하세요.

## 원본 콘텐츠
제목: ${originalTitle}
요약: ${originalSummary}

## 네이버 뉴스 검색 결과 (유사 기사)
${naverContext || "관련 기사 없음"}
${vectorContext}

## 교차 검증 체크리스트 (부정적 조건이 해당하면 true)
q1: 최초 출처와 작성자의 신뢰도에 대해 다른 소스들의 평가가 상충하는가?
q2: 본문에 제시된 수치와 외부 팩트의 일치 여부가 불확실한가?
q3: 인과관계 비약이나 선동 표현의 심각성에 대해 해석이 갈리는가?
q4: 정보의 유효 기간이나 시세 선반영 수준에 대한 판단이 엇갈리는가?
q5: 작성자의 숨겨진 이득 여부에 대해 '순수 정보'와 '광고' 사이 판단이 갈리는가?

## 판단 기준
- 네이버 뉴스에서 유사한 내용의 기사가 여러 개 확인되면 → 교차검증 통과 경향 (false)
- 검색 결과가 거의 없거나 내용이 상충하면 → 교차검증 실패 (true)
- 벡터 유사 인사이트가 있고 같은 맥락이면 → 신뢰도 상승 (false)
- 관련 기사가 0건이면 q1~q5 모두 true로 판정

JSON 배열로만 응답하세요: [true/false, true/false, true/false, true/false, true/false]`;

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
      console.error("Cross-verify AI error:", res.status);
      return [true, true, true, true, true]; // worst case
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Extract JSON array from response
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
    const { insightId, title, summary, content, userId } = await req.json();

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

    // 1. Generate embedding for the content
    const textForEmbedding = `${title}\n${summary || ""}\n${(content || "").slice(0, 1500)}`;
    const embedding = await generateEmbedding(textForEmbedding, lovableApiKey);

    // 2. Store embedding in vector store
    if (embedding && userId) {
      const { error: embedError } = await supabase
        .from("insight_embeddings")
        .upsert({
          insight_id: insightId,
          user_id: userId,
          content_text: textForEmbedding.slice(0, 5000),
          embedding: JSON.stringify(embedding),
        }, { onConflict: "insight_id" });

      if (embedError) {
        console.error("Embedding store error:", embedError);
      } else {
        console.log("Embedding stored for insight:", insightId);
      }
    }

    // 3. Search for similar insights in vector store
    let similarInsights: { insight_id: string; similarity: number }[] = [];
    if (embedding) {
      const { data: matches, error: matchError } = await supabase
        .rpc("match_insights", {
          query_embedding: JSON.stringify(embedding),
          match_threshold: 0.65,
          match_count: 5,
          p_user_id: userId || null,
        });

      if (matchError) {
        console.error("Vector search error:", matchError);
      } else {
        // Exclude the current insight from results
        similarInsights = (matches || []).filter(
          (m: any) => m.insight_id !== insightId
        );
        console.log(`Found ${similarInsights.length} similar insights`);
      }
    }

    // 4. Search Naver News for related articles
    // Extract key terms from title for search query
    const searchQuery = title.replace(/[^\w가-힣\s]/g, "").slice(0, 50);
    const naverArticles = await searchNaverNews(searchQuery, naverClientId, naverClientSecret);
    console.log(`Found ${naverArticles.length} Naver news articles`);

    // 5. Evaluate cross-verification using AI
    const crossVerifyFlags = await evaluateCrossVerification(
      title,
      summary || "",
      naverArticles,
      similarInsights,
      lovableApiKey
    );

    console.log("Cross-verification flags:", crossVerifyFlags);

    return new Response(
      JSON.stringify({
        success: true,
        flags: crossVerifyFlags,
        naver_count: naverArticles.length,
        similar_count: similarInsights.length,
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
