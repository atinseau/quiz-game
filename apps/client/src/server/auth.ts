import { verifyToken } from "@clerk/backend";
import type { WsData } from "./types";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export async function verifyClerkCookie(req: Request): Promise<WsData | null> {
  if (!CLERK_SECRET_KEY) {
    console.error("[ws/auth] CLERK_SECRET_KEY not set");
    return null;
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    }),
  );

  const token = cookies.__session;
  if (!token) return null;

  try {
    const verified = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    return {
      clerkId: verified.sub,
      username:
        (verified.username as string) ??
        (verified.email as string) ??
        verified.sub,
      gender: "homme",
    };
  } catch (err) {
    console.error("[ws/auth] Token verification failed:", err);
    return null;
  }
}
