"use server";

import { revalidatePath } from "next/cache";

import { setModeCookie, type Mode } from "./mode";

export async function toggleModeAction(target: Mode) {
  await setModeCookie(target);
  revalidatePath("/", "layout");
}
