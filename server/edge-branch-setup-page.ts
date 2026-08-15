// Public invitation entrypoint for authorized branch self-onboarding.
// Supabase shared Edge Function domains rewrite HTML GET responses to text/plain,
// so this endpoint only redirects to the Cloudflare Pages setup page.
Deno.serve((req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Content-Type": "text/plain;charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const incoming = new URL(req.url);
  const target = new URL("https://syllabuslagging.pages.dev/branch-setup.html");
  const key = incoming.searchParams.get("key");
  if (key) target.searchParams.set("key", key);

  return new Response(null, {
    status: 302,
    headers: {
      "Location": target.toString(),
      "Cache-Control": "no-store"
    }
  });
});
