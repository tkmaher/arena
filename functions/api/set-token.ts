export const onRequestPost: PagesFunction = async ({ request }) => {
  const { token } = await request.json<{ token: string }>();

  if (!token) {
    return new Response(JSON.stringify({ error: "No token" }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": [
        `arena_token=${token}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Path=/",
        "Max-Age=31536000", // 1 year
      ].join("; "),
    },
  });
};