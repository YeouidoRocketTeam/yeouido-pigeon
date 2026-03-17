import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ROC weights for 6 criteria
const WEIGHTS = {
  source_authority: 0.408,
  time_validity: 0.242,
  logical_completeness: 0.158,
  interest_transparency: 0.103,
  data_specificity: 0.061,
  cross_verification: 0.027,
};

// Points deducted per checklist item (1st=30, 2nd=25, 3rd=20, 4th=15, 5th=5)
const ITEM_POINTS = [30, 25, 20, 15, 5];

function computeCriterionScore(flags: boolean[]): number {
  let deduction = 0;
  for (let i = 0; i < 5; i++) {
    if (flags[i]) deduction += ITEM_POINTS[i];
  }
  return Math.max(5, 100 - deduction);
}

function computeFinalScore(details: Record<string, { flags: boolean[]; score: number }>): number {
  let total = 0;
  for (const [key, val] of Object.entries(details)) {
    total += (val.score / 100) * (WEIGHTS[key as keyof typeof WEIGHTS] || 0);
  }
  return Math.round(total * 100);
}

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
        headers: { "User-Agent": "Mozilla/5.0 (compatible; InsightBot/1.0)" },
      });
      const html = await pageResponse.text();
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      pageTitle = titleMatch ? titleMatch[1].trim() : "";
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } catch (fetchError) {
      console.error("Error fetching URL:", fetchError);
      await supabase.from("insights").update({
        status: "error",
        error_message: "URL을 가져올 수 없습니다.",
        original_title: url,
      }).eq("id", insightId);
      return new Response(
        JSON.stringify({ error: "Failed to fetch URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI analysis with new 6-criteria reliability checklist
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
            content: `You are an extremely strict and critical investment content analyst. Your job is to be HARSH and SKEPTICAL when evaluating reliability. Most content should score between 40-75. Only the best institutional reports with full data should score above 80. 

CRITICAL SCORING RULES:
- You MUST mark at least 2-3 items TRUE per criterion for typical news articles.
- Even major news outlets often lack comparative data, charts, risk analysis, or have timing issues.
- A typical Naver News article should score around 50-70, NOT 90-100.
- Only official securities firm reports with full financial data should approach 90+.
- Be especially strict on: data_specificity (most articles lack charts/comparisons), logical_completeness (most articles don't discuss risks), time_validity (most articles are already hours old).
- If you cannot verify something from the text, mark it TRUE (assume the worst).

Analyze the given article and:
1. Extract investment insights (title, summary, themes, stocks, sentiment, source type)
2. Evaluate reliability using a 6-criteria checklist system.

For each criterion, answer TRUE if the negative condition applies, FALSE if it doesn't. When in doubt, answer TRUE.

## Reliability Checklist (answer true/false for each):

### 1. source_authority (출처 권위도) - "말하는 사람이 믿을만한 전문가인가?"
- q1: 실명/법인명/사업자 등록 정보 등 법적 책임 주체를 확인할 수 없는 완전 익명인가?
- q2: 이름은 있으나 해당 분야 전문 자격(애널리스트, FP 등)이나 공인된 기관 프로필 인증이 없는가?
- q3: 해당 채널/계정이 생성된 지 6개월 미만인가?
- q4: 과거 허위 사실 유포나 오보로 신고/경고를 받은 기록이 있는가?
- q5: 제도권(증권사, 정부, 언론사)의 검토를 거치지 않은 개인의 주관적 의견인가?

### 2. data_specificity (데이터 구체성) - "실제 숫자나 도표가 있나?"
- q1: 종목 현재가, 목표주가, 상승률(%), 실적 중 단 하나의 숫자 데이터도 없는가?
- q2: 주가 차트, 재무제표 표, 공식 보도자료 이미지 등 시각적 증거가 없는가?
- q3: 경쟁사나 시장 지수(코스피/코스닥)와 비교한 수치가 전혀 없는가?
- q4: 기자 이름이 없거나, 참고 문헌/데이터 출처 언급이 없는가?
- q5: 분석 없이 단순한 사실만 1~2줄 적힌 '단순 공유' 형태인가?

### 3. logical_completeness (논리적 완결성) - "앞뒤 맥락이 맞고 과장이 없나?"
- q1: 원인과 결과 사이 상관관계가 없거나 중간 설명이 생략되어 있는가?
- q2: "무조건", "확정" 등 투자 결과를 장담하는 단정적 선동이 있는가?
- q3: 이미 주가가 변동한 뒤에 결과를 끼워 맞추는 사후 확신인가?
- q4: 하락 가능성이나 변수에 대한 언급이 없는가?
- q5: 오직 한 가지 이유만으로 전체 시장을 판단하려 하는가?

### 4. time_validity (시점 유효성) - "지금 바로 써먹을 수 있는 최신 정보인가?"
- q1: 정보 발생 직후 해당 종목의 거래량이 200% 이상 폭증하며 주가가 이미 급등/급락했는가?
- q2: 핵심 일정(청약일, 실적발표, 공시 기한 등)이 이미 종료되었는가?
- q3: 정보의 최초 생성 시각으로부터 6시간 이상 지났는가?
- q4: 12시간 이전에 배포된 뉴스를 기반으로 재가공한 것인가?
- q5: 작성일, 수정일 등 시각 데이터가 본문에 없는가?

### 5. interest_transparency (이해관계 투명성) - "광고나 홍보 목적을 숨기고 있지는 않나?"
- q1: 유료 리딩방/개인 톡방 가입 유도 등 폐쇄적 공간으로 유인하는가?
- q2: 종목 보유 여부를 밝히지 않았거나 유료 광고/협찬임을 숨기는가?
- q3: "리트윗 시 공개", "좋아요 100개 넘으면 공개" 등 반응 유도로 정보를 감추는가?
- q4: 리스크를 배제하고 특정 기업 장점만 나열하는 홍보성 데이터인가?
- q5: 본문과 무관한 인기 종목 해시태그를 남발하거나, "팔로우 시 정보 공개" 등 낚시인가?

### 6. cross_verification (교차 검증 일치도) - "다른 믿을만한 곳들도 같은 말을 하나?"
- q1: 최초 출처와 작성자의 신뢰도에 대해 다른 소스들의 평가가 상충하는가?
- q2: 본문에 제시된 수치와 외부 팩트의 일치 여부가 불확실한가?
- q3: 인과관계 비약이나 선동 표현의 심각성에 대해 해석이 갈리는가?
- q4: 정보의 유효 기간이나 시세 선반영 수준에 대한 판단이 엇갈리는가?
- q5: 작성자의 숨겨진 이득 여부에 대해 '순수 정보'와 '광고' 사이 판단이 갈리는가?

Respond ONLY with the tool call.`,
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
              description: "Extract investment insights and evaluate reliability checklist",
              parameters: {
                type: "object",
                properties: {
                  ai_title: {
                    type: "string",
                    description: "Concise Korean title summarizing the investment relevance (max 60 chars)",
                  },
                  ai_summary: {
                    type: "string",
                    description: "Comprehensive Korean summary of investment insights (2-4 sentences)",
                  },
                  source_type: {
                    type: "string",
                    enum: ["news", "report", "youtube", "sns", "community", "other"],
                  },
                  themes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Investment themes in Korean. Max 5.",
                  },
                  stocks: {
                    type: "array",
                    items: { type: "string" },
                    description: "Related stock names or tickers. Max 5.",
                  },
                  investment_sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative"],
                  },
                  // Reliability checklist - each is array of 5 booleans [q1..q5]
                  source_authority: {
                    type: "array",
                    items: { type: "boolean" },
                    description: "5 boolean flags for source authority checklist [q1,q2,q3,q4,q5]. true=negative condition applies.",
                  },
                  data_specificity: {
                    type: "array",
                    items: { type: "boolean" },
                    description: "5 boolean flags for data specificity checklist [q1,q2,q3,q4,q5]. true=negative condition applies.",
                  },
                  logical_completeness: {
                    type: "array",
                    items: { type: "boolean" },
                    description: "5 boolean flags for logical completeness checklist [q1,q2,q3,q4,q5]. true=negative condition applies.",
                  },
                  time_validity: {
                    type: "array",
                    items: { type: "boolean" },
                    description: "5 boolean flags for time validity checklist [q1,q2,q3,q4,q5]. true=negative condition applies.",
                  },
                  interest_transparency: {
                    type: "array",
                    items: { type: "boolean" },
                    description: "5 boolean flags for interest transparency checklist [q1,q2,q3,q4,q5]. true=negative condition applies.",
                  },
                  cross_verification: {
                    type: "array",
                    items: { type: "boolean" },
                    description: "5 boolean flags for cross verification checklist [q1,q2,q3,q4,q5]. true=negative condition applies.",
                  },
                },
                required: [
                  "ai_title", "ai_summary", "source_type", "themes", "stocks", "investment_sentiment",
                  "source_authority", "data_specificity", "logical_completeness",
                  "time_validity", "interest_transparency", "cross_verification",
                ],
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

    // Compute reliability scores from checklist flags
    const criteriaKeys = [
      "source_authority", "data_specificity", "logical_completeness",
      "time_validity", "interest_transparency", "cross_verification",
    ] as const;

    const reliabilityDetails: Record<string, { flags: boolean[]; score: number }> = {};
    for (const key of criteriaKeys) {
      const flags = Array.isArray(analysis[key]) ? analysis[key].slice(0, 5) : [false, false, false, false, false];
      // Pad to 5 if needed
      while (flags.length < 5) flags.push(false);
      const score = computeCriterionScore(flags);
      reliabilityDetails[key] = { flags, score };
    }

    const finalScore = computeFinalScore(reliabilityDetails);

    // Update insight
    await supabase.from("insights").update({
      original_title: pageTitle,
      ai_title: analysis.ai_title,
      ai_summary: analysis.ai_summary,
      source_type: analysis.source_type,
      reliability_score: finalScore,
      reliability_details: reliabilityDetails,
      themes: analysis.themes,
      stocks: analysis.stocks,
      investment_sentiment: analysis.investment_sentiment,
      status: "completed",
    }).eq("id", insightId);

    return new Response(
      JSON.stringify({ success: true, reliability_score: finalScore }),
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
