"use server";

import { redirect } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { players, gameSessions, puzzles } from "@/db/schema";
import { setSessionCookie } from "@/lib/session";
import { setAdminCookie } from "@/lib/admin-session";

// ---------------------------------------------------------------------------
// validateAccessCode — pure DB lookup, no side effects
// ---------------------------------------------------------------------------

export type PlayerMode = "scored" | "test";

export type ValidateResult =
  | { status: "NEW"; sessionId: null; playerId: string; mode: PlayerMode }
  | { status: "IN_PROGRESS"; sessionId: string; playerId: string; mode: PlayerMode }
  | { status: "DONE"; sessionId: string; playerId: string; mode: PlayerMode }
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

  const mode: PlayerMode = player.mode;

  if (mode === "test") {
    // Test players: check any session. Completed ones are wiped on re-login via login().
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.player_id, player.id))
      .orderBy(desc(gameSessions.start_time))
      .limit(1);

    if (!session) return { status: "NEW", sessionId: null, playerId: player.id, mode };
    if (session.status === "IN_PROGRESS") {
      return { status: "IN_PROGRESS", sessionId: session.id, playerId: player.id, mode };
    }
    return { status: "DONE", sessionId: session.id, playerId: player.id, mode };
  }

  // Scored players: restrict replay per-puzzle.
  // A DONE session for an OLD puzzle should not block play on a NEW active puzzle.
  const [activePuzzle] = await db
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(eq(puzzles.is_active, true))
    .limit(1);

  if (!activePuzzle) {
    // No active puzzle — treat as NEW; createSession() will surface the error.
    return { status: "NEW", sessionId: null, playerId: player.id, mode };
  }

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.player_id, player.id),
        eq(gameSessions.puzzle_id, activePuzzle.id)
      )
    )
    .orderBy(desc(gameSessions.start_time))
    .limit(1);

  if (!session) return { status: "NEW", sessionId: null, playerId: player.id, mode };
  if (session.status === "IN_PROGRESS") {
    return { status: "IN_PROGRESS", sessionId: session.id, playerId: player.id, mode };
  }
  return { status: "DONE", sessionId: session.id, playerId: player.id, mode };
}

// ---------------------------------------------------------------------------
// createSession — instantiates a new GameSession against the active puzzle.
// start_time is set server-side here; the client timer is purely cosmetic.
// ---------------------------------------------------------------------------

async function createSession(playerId: string, isTest: boolean): Promise<string> {
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
      is_test: isTest,
      start_time: new Date(), // server-authoritative
    })
    .returning({ id: gameSessions.id });

  return session.id;
}

// ---------------------------------------------------------------------------
// login — form action bound to the / login page.
//
// Scored flow:
//   INVALID      → redirect back to / with ?error=invalid
//   DONE         → session already complete → redirect to /leaderboard
//   IN_PROGRESS  → existing session → set cookie + redirect to /play
//   NEW          → create session → set cookie + redirect to /play
//
// Test flow:
//   INVALID      → redirect back to / with ?error=invalid
//   DONE         → delete old sessions + create fresh session → /play
//   IN_PROGRESS  → resume existing session → /play
//   NEW          → create session → set cookie + redirect to /play
// ---------------------------------------------------------------------------

export async function login(formData: FormData): Promise<never> {
  const code = (formData.get("code") as string | null)?.trim() ?? "";

  if (!code) redirect("/?error=invalid");

  // Admin shortcut: entering MAHANT_1933 opens the admin dashboard directly.
  // Sets the admin session cookie without going through the normal player flow.
  if (code.toUpperCase() === "MAHANT_1933") {
    await setAdminCookie();
    redirect("/admin");
  }

  const result = await validateAccessCode(code);

  if (result.status === "INVALID") {
    redirect("/?error=invalid");
  }

  // Scored player — completed game blocks further play; send to review
  if (result.mode === "scored" && result.status === "DONE") {
    await setSessionCookie(result.sessionId);
    redirect("/play/review");
  }

  let sessionId: string;

  if (result.status === "IN_PROGRESS") {
    sessionId = result.sessionId;
  } else if (result.mode === "test" && result.status === "DONE") {
    // Test player replaying — wipe old completed sessions and start fresh
    await db
      .delete(gameSessions)
      .where(eq(gameSessions.player_id, result.playerId));
    sessionId = await createSession(result.playerId, true);
  } else {
    // NEW for both modes
    sessionId = await createSession(result.playerId, result.mode === "test");
  }

  await setSessionCookie(sessionId);
  redirect("/play");
}
