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

const ITEM_POINTS = [30, 25, 20, 15, 10];

function computeCriterionScore(flags: boolean[]): number {
  let deduction = 0;
  for (let i = 0; i < 5; i++) {
    if (flags[i]) deduction += ITEM_POINTS[i];
  }
  return Math.max(0, 100 - deduction);
}

function computeFinalScore(details: Record<string, { flags: boolean[]; score: number }>): number {
  let total = 0;
  for (const [key, val] of Object.entries(details)) {
    total += (val.score / 100) * (WEIGHTS[key as keyof typeof WEIGHTS] || 0);
  }
  return Math.round(total * 100);
}

// ── YouTube helpers ──

/** Decode all HTML entities (named + numeric) */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

/** Fetch transcript list page and extract captions */
async function fetchYouTubeTranscript(videoId: string, lang?: string): Promise<string | null> {
  try {
    // Fetch the YouTube watch page to get captions player response
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": lang === "ko" ? "ko-KR,ko;q=0.9" : "en-US,en;q=0.9",
      },
    });
    const html = await res.text();

    // Extract captions data from ytInitialPlayerResponse
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
    if (!playerMatch) {
      console.log("No ytInitialPlayerResponse found");
      return null;
    }

    let playerData: any;
    try {
      playerData = JSON.parse(playerMatch[1]);
    } catch {
      console.log("Failed to parse player response");
      return null;
    }

    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      console.log("No caption tracks available");
      return null;
    }

    // Find the right track based on language preference
    let targetTrack = null;

    if (lang) {
      // Priority 1: manual track in requested language
      targetTrack = captionTracks.find(
        (t: any) => t.languageCode === lang && t.kind !== "asr"
      );
      // Priority 2: auto-generated track in requested language
      if (!targetTrack) {
        targetTrack = captionTracks.find(
          (t: any) => t.languageCode === lang && t.kind === "asr"
        );
      }
    }

    if (!targetTrack) {
      // Priority 3: any manual track
      targetTrack = captionTracks.find((t: any) => t.kind !== "asr");
    }

    if (!targetTrack) {
      // Priority 4: any auto-generated track
      targetTrack = captionTracks[0];
    }

    if (!targetTrack?.baseUrl) {
      console.log("No usable caption track found");
      return null;
    }

    console.log(`Found caption track: lang=${targetTrack.languageCode}, kind=${targetTrack.kind || "manual"}`);

    // Fetch the caption XML
    const captionRes = await fetch(targetTrack.baseUrl);
    const captionXml = await captionRes.text();

    // Parse XML to extract text
    const textSegments: string[] = [];
    const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let match;
    while ((match = regex.exec(captionXml)) !== null) {
      const decoded = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, " ")
        .trim();
      if (decoded) textSegments.push(decoded);
    }

    if (textSegments.length === 0) return null;

    const transcript = textSegments.join(" ").slice(0, 12000);
    console.log(`Extracted transcript: ${transcript.length} chars, ${textSegments.length} segments`);
    return transcript;
  } catch (e) {
    console.error("fetchYouTubeTranscript error:", e);
    return null;
  }
}

/** Scrape YouTube page for description + channel name (fallback for when no captions exist) */
async function fetchYouTubeMetadata(videoId: string): Promise<{ title: string; channel: string; description: string } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedRes = await fetch(oembedUrl);
    let oembedTitle = "";
    let oembedChannel = "";
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      oembedTitle = oembedData.title || "";
      oembedChannel = oembedData.author_name || "";
    } else {
      await oembedRes.text(); // consume body
    }

    // Fetch the watch page for description
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await watchRes.text();

    let description = "";
    // Try to extract from meta tag
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (descMatch) {
      description = descMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Also try og:description for longer text
    const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    if (ogDescMatch && ogDescMatch[1].length > description.length) {
      description = ogDescMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Try to get full description from ytInitialData
    const initialDataMatch = html.match(/ytInitialData\s*=\s*({.+?});/s);
    if (initialDataMatch) {
      try {
        const data = JSON.parse(initialDataMatch[1]);
        const engagementPanels = data?.engagementPanels;
        if (engagementPanels) {
          for (const panel of engagementPanels) {
            const content = panel?.engagementPanelSectionListRenderer?.content?.structuredDescriptionContentRenderer?.items;
            if (content) {
              for (const item of content) {
                const descText = item?.expandableVideoDescriptionBodyRenderer?.descriptionBodyText?.runs;
                if (descText) {
                  description = descText.map((r: any) => r.text).join("").slice(0, 4000);
                  break;
                }
              }
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!oembedTitle && !description) return null;

    return {
      title: oembedTitle,
      channel: oembedChannel,
      description: description.slice(0, 4000),
    };
  } catch (e) {
    console.error("fetchYouTubeMetadata error:", e);
    return null;
  }
}

/**
 * YouTube content extraction with fallback chain:
 * 1. Korean manual subtitles
 * 2. Any language subtitles (manual or auto-generated)
 * 3. Video description + channel name
 * 4. null (분석 불가)
 */
async function extractYouTubeContent(videoId: string): Promise<{
  content: string;
  title: string;
  method: string;
} | null> {
  // 1순위: 한국어 수동 자막
  console.log("YouTube extraction: trying Korean subtitles...");
  let transcript = await fetchYouTubeTranscript(videoId, "ko");
  if (transcript) {
    const meta = await fetchYouTubeMetadata(videoId);
    return {
      content: transcript,
      title: meta?.title || "",
      method: "korean_subtitle",
    };
  }

  // 2순위: 전 언어 자막 (수동 + 자동 생성 포함)
  console.log("YouTube extraction: trying any language subtitles...");
  transcript = await fetchYouTubeTranscript(videoId);
  if (transcript) {
    const meta = await fetchYouTubeMetadata(videoId);
    return {
      content: transcript,
      title: meta?.title || "",
      method: "any_subtitle",
    };
  }

  // 3순위 & 4순위: 영상 설명 + 채널명 (yt-dlp 대체 - Deno에서 바이너리 실행 불가)
  console.log("YouTube extraction: trying description + channel...");
  const meta = await fetchYouTubeMetadata(videoId);
  if (meta && (meta.description || meta.title)) {
    const parts: string[] = [];
    if (meta.channel) parts.push(`채널: ${meta.channel}`);
    if (meta.title) parts.push(`제목: ${meta.title}`);
    if (meta.description) parts.push(`설명: ${meta.description}`);
    return {
      content: parts.join("\n\n"),
      title: meta.title,
      method: "description",
    };
  }

  // 최후위: 분석 불가
  console.log("YouTube extraction: all methods failed");
  return null;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let parsedInsightId: string | null = null;
  try {
    const body = await req.json();
    const { insightId, url } = body;
    parsedInsightId = insightId;

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

    let pageContent = "";
    let pageTitle = "";
    let sourceName = ""; // 언론사명, 채널명 등
    let isYouTube = false;

    // ── YouTube URL handling ──
    if (isYouTubeUrl(url)) {
      isYouTube = true;
      const videoId = extractYouTubeVideoId(url);

      if (!videoId) {
        await supabase.from("insights").update({
          status: "error",
          error_message: "유효하지 않은 유튜브 URL입니다.",
          original_title: url,
        }).eq("id", insightId);
        return new Response(
          JSON.stringify({ error: "Invalid YouTube URL" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing YouTube video: ${videoId}`);
      const ytResult = await extractYouTubeContent(videoId);

      if (!ytResult) {
        await supabase.from("insights").update({
          status: "error",
          error_message: "유튜브 영상의 자막 및 설명을 가져올 수 없어 분석이 불가합니다.",
          original_title: url,
        }).eq("id", insightId);
        return new Response(
          JSON.stringify({ error: "YouTube content extraction failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`YouTube content extracted via: ${ytResult.method}`);
      pageTitle = ytResult.title;
      pageContent = ytResult.content;
      // 유튜브 채널명 추출
      const meta = await fetchYouTubeMetadata(videoId);
      sourceName = meta?.channel || "YouTube";
    } else {
      // ── Regular URL handling ──
      try {
        const pageResponse = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; InsightBot/1.0)" },
        });
        const html = await pageResponse.text();
        
        // Extract og:site_name for publisher name (e.g. 연합뉴스, 한국경제)
        const ogSiteNameMatch = html.match(/<meta\s+(?:property|name)="og:site_name"\s+content="([^"]*)"/i)
          || html.match(/<meta\s+content="([^"]*)"\s+(?:property|name)="og:site_name"/i);
        if (ogSiteNameMatch) {
          sourceName = ogSiteNameMatch[1]
            sourceName = decodeHtmlEntities(ogSiteNameMatch[1]).trim();
        }
        
        // Fallback: try application-name or publisher meta
        if (!sourceName) {
          const publisherMatch = html.match(/<meta\s+(?:property|name)="(?:publisher|application-name|author)"\s+content="([^"]*)"/i)
            || html.match(/<meta\s+content="([^"]*)"\s+(?:property|name)="(?:publisher|application-name|author)"/i);
          if (publisherMatch) {
            sourceName = decodeHtmlEntities(publisherMatch[1]).trim();
          }
        }

        // Try og:title first (usually the clean article title)
        const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
        if (ogTitleMatch) {
          pageTitle = decodeHtmlEntities(ogTitleMatch[1]).trim();
        } else {
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "";
          pageTitle = pageTitle.replace(/\s*[:\|\-–—]\s*(네이버\s*뉴스|네이버|Naver|NAVER).*$/i, "").trim();
        }
        
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
    }
    
    // Fallback: use domain name if no source name found
    if (!sourceName) {
      try {
        sourceName = new URL(url).hostname.replace("www.", "");
      } catch {
        sourceName = url;
      }
    }

    // ── AI analysis ──
    const contentLabel = isYouTube ? "YouTube video transcript/description" : "article";
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
- For YouTube content: be extra strict on source_authority (most YouTubers lack professional credentials) and data_specificity (videos rarely have detailed charts/data).

Analyze the given ${contentLabel} and:
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
- q4: RAG를 통해 추출된 해당 정보의 최초 발생 시점과 현재 에이전트가 참조하는 최근 데이터 간에 유의미한 시차가 존재하여, 정보의 유효성(이미 반영된 호재/악재 여부)에 대해 에이전트 간 결론이 대립하는가?
- q5: 본문 내에 시스템이 추적할 수 없는 외부 연결망(오픈채팅, 텔레그램, 개인 톡방 등)의 URL이나 ID가 포함되어 있는가? 또는 텍스트 내 이모지 및 특수문자의 비중이 전체 글자 수의 10%를 초과하는 등 일반적인 정보 전달 형식을 벗어나는가?

Respond ONLY with the tool call.`,
          },
          {
            role: "user",
            content: `Analyze this investment-related ${contentLabel}:\n\nURL: ${url}\nTitle: ${pageTitle}\n\nContent:\n${pageContent}`,
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
                    description: "Korean summary as exactly 3 short bullet points separated by newlines. Each point must be one concise sentence (under 30 chars) capturing a key insight. Example format: '현대차, 엔비디아와 자율주행·SDV 협업 확대 기대\nKAI는 방산 랠리 주춤 속 저가매수로 순매수 2위\n삼성전자우, AI칩 파운드리 기대에 동반 강세'",
                  },
                  ai_keywords: {
                    type: "string",
                    description: "Exactly 3 ultra-short Korean keyword headlines, each under 15 characters, separated by newlines. No numbering, no punctuation. Example: '희토류 회수 기술\n공급망 안정화\n상업 생산 목표'",
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
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Korean stock name (e.g. 삼성전자)" },
                        code: { type: "string", description: "6-digit Korean stock code (e.g. 005930). Must be the exact KOSPI/KOSDAQ ticker code." },
                        reason: { type: "string", description: "Why this stock is related. Must include relevance level keyword: include '1순위' or '직접' or '핵심' for stocks directly mentioned in content, include '2순위' or '대표' for top market cap stocks in the theme, include '3순위' or '간접' or '매크로' for supply chain/competitor/macro related stocks." },
                      },
                      required: ["name", "code", "reason"],
                    },
                    description: "Related Korean stocks with their exact 6-digit stock codes and relevance reasons. Max 5.",
                  },
                  investment_sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative"],
                  },
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
                  "ai_title", "ai_summary", "ai_keywords", "source_type", "themes", "stocks", "investment_sentiment",
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

    // Compute reliability scores for non-cross-verification criteria first
    const criteriaKeys = [
      "source_authority", "data_specificity", "logical_completeness",
      "time_validity", "interest_transparency", "cross_verification",
    ] as const;

    const reliabilityDetails: Record<string, { flags: boolean[]; score: number }> = {};
    for (const key of criteriaKeys) {
      const flags = Array.isArray(analysis[key]) ? analysis[key].slice(0, 5) : [false, false, false, false, false];
      while (flags.length < 5) flags.push(false);
      const score = computeCriterionScore(flags);
      reliabilityDetails[key] = { flags, score };
    }

    // ── Run cross-verification and detail summary in PARALLEL ──
    const insightRecordPromise = supabase
      .from("insights")
      .select("user_id")
      .eq("id", insightId)
      .single();

    // Launch tasks in parallel
    const [crossVerifyResult, detailResult] = await Promise.allSettled([
      // Task 1: Cross-verification
      (async () => {
        const { data: insightRecord } = await insightRecordPromise;
        const crossVerifyResponse = await fetch(
          `${supabaseUrl}/functions/v1/cross-verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              insightId,
              title: analysis.ai_title || pageTitle,
              summary: analysis.ai_summary || "",
              content: pageContent.slice(0, 2000),
              userId: insightRecord?.user_id || null,
              themes: analysis.themes || [],
              stocks: analysis.stocks || [],
            }),
          }
        );
        if (crossVerifyResponse.ok) {
          return await crossVerifyResponse.json();
        }
        console.error("Cross-verify call failed:", crossVerifyResponse.status);
        return null;
      })(),

      // Task 2: Detail summary
      (async () => {
        const detailResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "You are a Korean investment content analyst. Write a concise analysis of the given investment content in Korean. The analysis should be exactly 3-4 short paragraphs, each 80-120 characters long. Cover: (1) key facts and context, (2) market implications, (3) risks and opportunities. Write in a professional but accessible tone. Each paragraph must be concise and impactful - avoid filler words. Output paragraphs separated by double newlines (\\n\\n). No numbers, no bullets, no headers.",
              },
              {
                role: "user",
                content: `다음 투자 콘텐츠를 간결하게 분석해줘. 핵심만 담아 3~4개 짧은 문단으로 작성해:\n\n제목: ${pageTitle}\n요약: ${analysis.ai_summary}\n\n원문 내용:\n${pageContent.slice(0, 5000)}`,
              },
            ],
          }),
        });
        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          return detailData.choices?.[0]?.message?.content?.trim() || "";
        }
        return "";
      })(),
    ]);

    // Process cross-verification result
    if (crossVerifyResult.status === "fulfilled" && crossVerifyResult.value?.success) {
      const cvResult = crossVerifyResult.value;
      const cvFlags = cvResult.flags.map((f: any) => Boolean(f));
      while (cvFlags.length < 5) cvFlags.push(true);
      reliabilityDetails.cross_verification = {
        flags: cvFlags.slice(0, 5),
        score: computeCriterionScore(cvFlags.slice(0, 5)),
      };
      console.log(
        `Cross-verification RAG: naver=${cvResult.naver_count}, similar=${cvResult.similar_count}, score=${reliabilityDetails.cross_verification.score}`
      );
    }

    // Process detail summary result
    const aiSummaryDetail = detailResult.status === "fulfilled" ? (detailResult.value as string) : "";

    // Compute final overall reliability score using weighted ROC method
    const finalScore = computeFinalScore(reliabilityDetails);

    // Preserve original source_domain if already set (e.g., from fetch-subscription)
    const { data: currentInsight } = await supabase.from("insights").select("source_domain").eq("id", insightId).single();
    
    const { error: updateError } = await supabase.from("insights").update({
      original_title: pageTitle,
      ai_title: analysis.ai_title,
      ai_summary: analysis.ai_summary,
      ai_keywords: analysis.ai_keywords || null,
      ai_summary_detail: aiSummaryDetail || null,
      source_type: isYouTube ? "youtube" : analysis.source_type,
      source_domain: currentInsight?.source_domain || sourceName,
      reliability_score: finalScore,
      reliability_details: reliabilityDetails,
      themes: analysis.themes,
      stocks: analysis.stocks || [],
      investment_sentiment: analysis.investment_sentiment,
      status: "completed",
    }).eq("id", insightId);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    console.log("Successfully updated insight:", insightId, "score:", finalScore);

    return new Response(
      JSON.stringify({ success: true, reliability_score: finalScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-insight error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update insight status to error so it doesn't stay stuck in "processing"
    try {
      if (parsedInsightId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("insights").update({
          status: "error",
          error_message: `분석 중 오류가 발생했습니다: ${errorMessage}`,
        }).eq("id", parsedInsightId);
      }
    } catch (dbErr) {
      console.error("Failed to update error status:", dbErr);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
