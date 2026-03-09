# BKST NYC Implementation Plan

Source: Antigravity planning output

## Notes

This document is the source of truth for architecture and implementation order.
Claude Code should follow this plan unless a deviation is explicitly justified.

Connections-Style Web App: Architecture & Implementation Plan
Overview
This document outlines the architecture, data model, and phased execution plan for a custom Vercel-hosted Connections clone. It is optimized for a robust, secure experience while keeping the setup lean and straightforward for a solo developer utilizing an AI coding assistant.

1. Recommended Stack
   Framework: Next.js (App Router). This is the optimal choice since we can leverage Server Components for retrieving the puzzle matrix securely, and Client Components for the interactive 4x4 game grid.
   Styling: Vanilla CSS or CSS Modules. Keeps the project simpler to maintain while allowing for premium, bespoke styling (glassmorphism, vibrant colors, targeted micro-animations) without a heavy utility class system overhead.
   Database: Vercel Postgres. Native integration with Vercel means zero configuration of connection secrets manually.
   ORM: Drizzle ORM. Extremely lightweight, highly performant, type-safe, and edge-compatible. Simpler conceptual overhead than Prisma.
2. Vercel Blob Usage
   Recommendation: Do NOT use Vercel Blob. Vercel Blob is meant for storing large, unstructured files (like images, audio clips, video). Connections is fundamentally a text-based game. All data (categories, words, players, and session state) belongs in your relational database. Using blob storage adds unnecessary structural complexity to a text puzzle.

3. Recommended Backend & Auth Approach
   Player Auth: Determined Access Tokens (Access Codes). End users do not create public accounts. The Admin pre-generates Players with a unique access_code. Users log in using only this code.
   One-time Access: Once an access code starts a session, it is locked. After the game ends (Win/Loss), that code can never trigger a new GameSession, but it can pull up historical results.
   Admin Auth: NextAuth.js (Auth.js) Credentials Provider or a simple JWT edge middleware. Since it's only for you, a single environment-variable-backed secret password or a simple Admin table is sufficient to gate your puzzle editor.
4. Why This Stack is Perfect for a Solo Builder
   It drastically reduces moving parts. You don't need an external caching system like Redis (Postgres handles session state), you don't need to configure Google SSO for players, and everything lives and deploys seamlessly on Vercel from a single repository.

5. Backend Option Tradeoffs
   Option A: Supabase (Postgres + Auth + Real-time)

Pros: Built-in Row Level Security (RLS) and instant APIs.
Cons: Supabase's authentication relies heavily on standard patterns (email/password, OAuth). Using it for custom "single-use string codes" creates friction. You also must manage a secondary dashboard outside of Vercel.
Option B: Vercel Postgres + Drizzle ORM (WINNER)

Pros: Everything is unified in your Vercel project metrics. You have absolute control over the custom "access code" auth logic via simple Next.js Server Actions. Your schema lives entirely locally in your codebase.
Cons: You must build your own admin CRUD interface (which is mitigated, since we need an admin console anyway). 6. Data Model Design
Here is the foundational relational schema:

Admin

id (UUID)
username (String)
password_hash (String)
Puzzle

id (UUID)
title (String) - e.g., "Company Retreat 2024"
is_active (Boolean) - Only one active puzzle at a time
created_at (Timestamp)
Category

id (UUID)
puzzle_id (UUID, FK)
title (String) - e.g., "Types of Cheese"
difficulty (Int) - 1 (Easiest, yellow) to 4 (Hardest, purple)
color_theme (String)
Word

id (UUID)
category_id (UUID, FK)
text (String)
Player

id (UUID)
access_code (String, Unique) - e.g., "ALPHA-942"
display_name (String)
GameSession

id (UUID)
player_id (UUID, FK, Unique constraint ensures one run per player)
puzzle_id (UUID, FK)
start_time (Timestamp)
end_time (Timestamp, Nullable)
mistakes_made (Int, Default 0)
status (Enum: IN_PROGRESS, WON, LOST)
score (Int, Nullable)
Guess (Optional, good for anti-cheat and analytics)

id (UUID)
session_id (UUID, FK)
guessed_words (Array of Word IDs)
is_correct (Boolean)
created_at (Timestamp) 7. Score Formula
Recommendation: Base Goal + Speed Bonus - Mistake Penalty

Base Score: 1,000 points assigned for completing the board. (0 if they fail out).
Speed Bonus: Maximum 500 bonus points. Let's establish a base "par" time of 30 seconds.
Solving in ≤ 30s grants 500 points.
Every second over 30 deducts 5 points from the bonus, down to 0 at 130 seconds.
Mistakes Penalty: -150 points per mistake made.
(Formula: Total = Base (1000) + Max(0, 500 - ((Seconds*Taken - 30) * 5)) - (Mistakes \_ 150))

8. Exact Game Flow
   Access: User visits / and enters their access_code.
   Setup: Server verifies code in Player table. If a session is WON/LOST, they are routed to the leaderboard. If new, it creates a GameSession, establishing an authoritative server start_time.
   Session Start: User reaches /play. Server sends all 16 Word texts randomly mixed, along with the session_id. Server NEVER sends the categories/answers to the client.
   Gameplay: Client controls the UX. User picks 4 words and clicks submit.
   Validation: Client calls Next.js Server Action submitGuess(word_ids, session_id).
   Server Step: Server evaluates if the 4 IDs belong to the same category_id.
   If Incorrect: Server increments mistakes_made in DB. Action returns <Error>. UI triggers wrong animation.
   If Correct: Action returns the Name and Color of the solved Category. UI groups and locks them at the top.
   Endgame: Server actively flags when a session hits 4 mistakes or 4 wins. Updates end_time efficiently securely on the backend server, preventing client timer hacks. Calculates score.
   Results: App redirects to /leaderboard displaying final standings.
9. Security & Abuse Risks
   Sharing IDs: Multiple unauthorized users try the same access token.
   Replay Attacks: Developer tools extraction to figure out the puzzle grid, followed by a rapid resubmission on a clean tab.
   Client-side Tampering: Finding the correct answers in the browser's raw network payload or DOM.
   Multiple tabs / Timer dodging: Attempting to "pause" the timer by stopping the client script.
   Refresh loop: Reloading the browser when getting a guess wrong to erase mistakes.
   API brute-force: Rapidly sending automated guesses.
10. Mitigation Strategies
    Sharing IDs: GameSession enforces a unique constraint on player_id. The second someone tries the code, the access token is marked "active" and tied to that single run.
    Client-side Tampering: The Next.js server ONLY pushes string words to the initial page render. No metadata denoting "cheese group" is rendered until the client legally solves it server-side.
    Timer Dodging: Time is strictly Server Time End - Server Time Start. The client timer is purely visual cosmetics. Closing the tab means the clock is still running.
    Refresh Loop: Server action persists mistakes_made BEFORE answering the client. A page refresh reconstructs the grid exact to the user's IN_PROGRESS state.
    Brute Force: Cap the game at 4 total mistakes. Mathematical brute forcing triggers the loss condition instantaneously rendering the session LOST.
11. Implementation Phases & Milestones
    Phase 1: Foundation (MVP) - Next/DB scaffold. Data models & dummy data.
    Phase 2: Core Game Engine - Visual grid component, select state, lock logic, and the submitGuess Server Action.
    Phase 3: Auth & Sessions - Simple logic for the /, session generation hook, and start_time protection.
    Phase 4: Scoring & Leaderboards - Implementation of score math and building the /leaderboard UI matrix.
    Phase 5: Admin Tooling - Gating an /admin route with password validation. Building CRUD forms to easily add puzzles and mass-generate players.
    Phase 6: Hardening & Visual Deploy - Polishing animations, mobile responsive cleanup, and releasing to Vercel.
12. Engineering Tasks / Sub-tasks
    (Please refer to the separate task.md artifact which breaks this exact section down specifically for agent workflows).

13. Server-Side vs. Client-Side Responsibilities
    Server-Side:

Initializing the 16 words array unmapped.
Validating the access code existence & state.
Authoritatively recording start_time and end_time.
Processing guesses; mutating mistakes tally.
Computing mathematical leaderboard results.
Client-Side:

Highlight selected words (arrays max length 4).
Initiating shake (failed guess) or hop (proper guess) visual animations.
Cosmetic local stopwatch display. 14. Server Actions / API Structure
Instead of generic REST API routes, use typed Next.js Server Actions in src/actions/:

auth.ts -> validateAccessCode(code: string)
game.ts -> submitGuess(session_id: string, words: string[])
admin.ts -> createPuzzle(...), generatePlayers(count: number, prefix: string) 15. Next.js App Router Structure
text
src/
├── app/
│ ├── layout.tsx
│ ├── page.tsx (Login Gateway)
│ ├── play/
│ │ └── page.tsx (Grid UI)
│ ├── leaderboard/
│ │ └── page.tsx
│ └── admin/
│ ├── layout.tsx (Admin Gate)
│ └── page.tsx
├── actions/
│ ├── game.ts
│ ├── auth.ts
│ └── admin.ts
├── components/
│ ├── game/
│ │ ├── Board.tsx
│ │ └── WordCard.tsx
│ └── ui/
│ └── SystemButton.tsx
├── db/
│ ├── schema.ts
│ └── index.ts
└── lib/
├── math.ts
└── utils.ts 16. Deployment Plan
Push project skeleton to GitHub.
Import project via Vercel dashboard.
Tap "Storage" -> "Add Vercel Postgres" and link to the project.
Set necessary Environment Variables (see Step 17).
Deploy. Standard Node.js serverless functions work perfectly. 17. Environment Variables Needed
bash

# Database injection directly from Vercel

POSTGRES_URL="postgres://..."

# Admin Portal Password secret

ADMIN_KEY="your_secure_passphrase" 18. Build Order / Handoff
When handing this off to Claude Code or Codex, explicitly ask for the build in this order:

Infrastructure: "Set up the Next.js project with App Router. Install Drizzle ORM and configure schema.ts based on our architectural models. Create a seed script."
Server Logic: "Write the Server Actions in src/actions/game.ts. The actions must evaluate guesses entirely server-side without exposing category data early."
Frontend Grid: "Implement the visual /play grid. Style using high-end CSS transitions for hover, select, reject-shake, and solve-lock interactions."
Auth & Sessions: "Wire the / root login page to validate the access code against the database. Construct the Session on valid entry, then route to the grid."
Leaderboard & Math: "Implement the server end-game triggers, execute the point formula, and construct the public /leaderboard UI."
Admin System: "Build out /admin dashboard. Gated simple password check, and basic simple inputs to push categories to DB."

Connections App Task Breakdown
Phase 1: Foundation & Data
Initialize Next.js App Router project
Setup Drizzle ORM & configure Vercel Postgres connection
Define database models in schema.ts (Admin, Puzzle, Category, Word, Player, GameSession)
Write seed script to insert test dummy data (1 puzzle, 4 categories, 16 words, 1 player)
Phase 2: Core Game Engine
Build WordCard interactive UI component (base, selected, incorrect styling)
Build Board 4x4 layout component
Implement local state for selecting up to 4 words
Create submitGuess Server Action (validate IDs against schema)
Implement UX feedback (Invalid guess shake animation, Correct guess collapsing and coloring)
Phase 3: Auth & Sessions
Develop / login screen for access code input
Implement logic to validate access_code and create a uniquely linked GameSession
Record hard server-side start_time upon session initialization
Build route protection interceptors ensuring users cannot visit /play without an active session
Phase 4: Leaderboard & Scoring
Implement point calculating formula utilities inside lib/math.ts
Ensure end_time logic fires securely as the fourth mistake or fourth category is mapped
Build public /leaderboard querying and displaying descending rankings
Phase 5: Admin Tooling
Develop basic JWT or Cookie auth wall for the /admin route utilizing ADMIN_KEY
Build Admin UI mapping all historically executed sessions
Build simple Puzzle Builder form (1 title + 4 sets of 4 words & difficulty keys)
Build Player Batch Generator (e.g. create 50 randomized codes and push to DB)
Phase 6: Polish & Security
Add Framer Motion (or heavily structured vanilla CSS) for smooth category restructuring arrays
Thoroughly restrict multiple submission clicks during latency periods (debounce clientside + atomic server side)
Mobile responsive QA verification
Trigger Vercel deploy
