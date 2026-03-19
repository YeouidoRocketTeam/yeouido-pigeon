const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keywords, themes } = await req.json();

    const clientId = Deno.env.get('NAVER_CLIENT_ID');
    const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Naver API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query from keywords and themes
    const searchTerms: string[] = [];
    if (keywords) {
      searchTerms.push(...keywords.split('\n').filter((k: string) => k.trim()).slice(0, 2));
    }
    if (themes && themes.length > 0) {
      searchTerms.push(themes[0]);
    }

    const query = searchTerms.join(' ').trim();
    if (!query) {
      return new Response(
        JSON.stringify({ success: true, articles: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching Naver News for:', query);

    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=5&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Naver API error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Naver API request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const articles = (data.items || []).slice(0, 2).map((item: any) => {
      // Clean HTML tags from title and description
      const cleanTitle = (item.title || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const cleanDesc = (item.description || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

      // Extract domain
      let domain = '';
      try {
        domain = new URL(item.originallink || item.link).hostname.replace('www.', '');
      } catch {}

      return {
        title: cleanTitle,
        description: cleanDesc,
        url: item.originallink || item.link,
        domain,
        pubDate: item.pubDate,
      };
    });

    return new Response(
      JSON.stringify({ success: true, articles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
