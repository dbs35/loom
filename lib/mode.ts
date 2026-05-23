import "server-only";
import { cookies } from "next/headers";

export type Mode = "reader" | "contributor";

const COOKIE_NAME = "pc_mode";

export async function getMode(): Promise<Mode> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "contributor"
    ? "contributor"
    : "reader";
}

export async function setModeCookie(mode: Mode): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
}
