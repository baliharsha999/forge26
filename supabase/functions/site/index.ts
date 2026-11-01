import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    // Fetch HTML from Supabase Storage CDN public bucket
    const storageHtmlUrl = "https://ocplgpmsfwibjzjvxynv.supabase.co/storage/v1/object/public/website/index.html";
    const res = await fetch(storageHtmlUrl);
    
    if (res.ok) {
      const htmlText = await res.text();
      return new Response(htmlText, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60"
        }
      });
    }

    return new Response("Nagarik AI Portal Loading...", {
      headers: { "Content-Type": "text/plain" }
    });
  } catch (err: any) {
    return new Response("Error: " + err.message, { status: 500 });
  }
});
