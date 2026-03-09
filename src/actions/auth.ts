"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players, gameSessions, puzzles } from "@/db/schema";
import { setSessionCookie } from "@/lib/session";

// ---------------------------------------------------------------------------
// validateAccessCode — pure DB lookup, no side effects
// ---------------------------------------------------------------------------

export type ValidateResult =
  | { status: "NEW"; sessionId: null; playerId: string }
  | { status: "IN_PROGRESS"; sessionId: string; playerId: string }
  | { status: "DONE"; sessionId: string; playerId: string }
  | { status: "INVALID" };

export async function validateAccessCode(
  code: string
): Promise<ValidateResult> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.access_code, code.trim().toUpperCase()))
    .limit(1);

  if (!player) return { status: "INVALID" };

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.player_id, player.id))
    .limit(1);

  if (!session) {
    return { status: "NEW", sessionId: null, playerId: player.id };
  }

  if (session.status === "IN_PROGRESS") {
    return { status: "IN_PROGRESS", sessionId: session.id, playerId: player.id };
  }

  return { status: "DONE", sessionId: session.id, playerId: player.id };
}

// ---------------------------------------------------------------------------
// createSession — instantiates a new GameSession against the active puzzle.
// start_time is set server-side here; the client timer is purely cosmetic.
// ---------------------------------------------------------------------------

async function createSession(playerId: string): Promise<string> {
  const [puzzle] = await db
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(eq(puzzles.is_active, true))
    .limit(1);

  if (!puzzle) {
    throw new Error("No active puzzle. Ask the admin to activate one.");
  }

  const [session] = await db
    .insert(gameSessions)
    .values({
      player_id: playerId,
      puzzle_id: puzzle.id,
      start_time: new Date(), // server-authoritative
    })
    .returning({ id: gameSessions.id });

  return session.id;
}

// ---------------------------------------------------------------------------
// login — form action bound to the / login page.
//
// Flow:
//   INVALID      → redirect back to / with ?error=invalid
//   DONE         → session already complete → redirect to /leaderboard
//   IN_PROGRESS  → existing session → set cookie + redirect to /play
//   NEW          → create session → set cookie + redirect to /play
// ---------------------------------------------------------------------------

export async function login(formData: FormData): Promise<never> {
  const code = (formData.get("code") as string | null)?.trim() ?? "";

  if (!code) redirect("/?error=invalid");

  const result = await validateAccessCode(code);

  if (result.status === "INVALID") {
    redirect("/?error=invalid");
  }

  if (result.status === "DONE") {
    redirect("/leaderboard");
  }

  let sessionId: string;

  if (result.status === "IN_PROGRESS") {
    sessionId = result.sessionId;
  } else {
    // NEW — create the session; start_time is locked here
    sessionId = await createSession(result.playerId);
  }

  await setSessionCookie(sessionId);
  redirect("/play");
}
