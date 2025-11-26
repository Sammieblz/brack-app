import { corsHeaders } from "./cors.ts";

type ParsedBody<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: Response };

export const parseJsonBody = async <T>(req: Request): Promise<ParsedBody<T>> => {
  try {
    const data = await req.json() as T;
    return { data };
  } catch (_err) {
    return {
      error: new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }
};

export const requireFields = (
  body: Record<string, unknown>,
  fields: string[],
): Response | null => {
  const missing = fields.filter((field) => {
    const value = body[field];
    return value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0);
  });

  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return null;
};
