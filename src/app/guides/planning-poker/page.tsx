import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "planning-poker";

export const metadata = guideMetadata({
  slug,
  title: "Planning Poker for Agile Teams",
  description:
    "Run real-time planning poker sessions from the browser. Create a session, share the code, and estimate user stories together using Fibonacci, T-shirt, or custom scales.",
  keywords: [
    "planning poker",
    "agile estimation",
    "scrum",
    "story points",
    "sprint planning",
    "fibonacci estimation",
    "t-shirt sizing",
    "team estimation",
    "real-time voting",
    "remote planning",
  ],
});

export default function PlanningPokerGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>What is planning poker?</Guide.H2>
        <Guide.P>
          Planning poker is an estimation technique used by agile teams to
          size user stories. Each team member independently picks a card
          representing their estimate, and all votes are revealed
          simultaneously. This prevents anchoring bias — no one is
          influenced by someone else&apos;s estimate before committing to
          their own.
        </Guide.P>
        <Guide.P>
          The 1tt.dev Planning Poker tool runs entirely in the browser with
          real-time WebSocket communication. No install, no sign-up for
          voters, no desktop app.
        </Guide.P>

        <Guide.H2>Creating a session</Guide.H2>
        <Guide.P>
          The session owner (product owner, scrum master, or whoever is
          leading the ceremony) signs in and creates a session. Pick a name
          like &quot;Sprint 24 Planning&quot; and choose an estimation
          scale:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Fibonacci</Guide.Strong> — 0, 1, 2, 3, 5, 8,
            13, 21, 34, 55, 89, ? — the most common scale for story points
          </li>
          <li>
            <Guide.Strong>Modified Fibonacci</Guide.Strong> — 0, 1, 2, 3,
            5, 8, 13, 20, 40, 100 — popular for larger ranges
          </li>
          <li>
            <Guide.Strong>T-shirt sizes</Guide.Strong> — XS, S, M, L, XL,
            XXL — good for early-stage estimation or non-technical
            stakeholders
          </li>
          <li>
            <Guide.Strong>Powers of 2</Guide.Strong> — 1, 2, 4, 8, 16,
            32, 64 — useful when doubling effort is a natural progression
          </li>
          <li>
            <Guide.Strong>Simple</Guide.Strong> — 1, 2, 3, 4, 5 — for
            quick relative sizing
          </li>
        </Guide.UL>
        <Guide.P>
          A 6-character session code is generated and displayed at the top
          of the screen. Share this code (or the full URL) with your team.
        </Guide.P>

        <Guide.H2>Joining a session</Guide.H2>
        <Guide.P>
          Voters don&apos;t need an account. They go to the Planning Poker
          tool, enter the session code, and pick a display name. Logged-in
          users can join with one click using their account name.
        </Guide.P>
        <Guide.P>
          The session validates the code before showing the join form — if
          the code is invalid or the session has been disabled, voters see
          a clear error message instead of a broken connection.
        </Guide.P>

        <Guide.H2>The estimation flow</Guide.H2>
        <Guide.P>
          A typical planning poker round works like this:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>1. Owner adds a story</Guide.Strong> — title and
            optional description (acceptance criteria, technical notes,
            links)
          </li>
          <li>
            <Guide.Strong>2. Owner starts voting</Guide.Strong> — the
            voting cards appear for everyone
          </li>
          <li>
            <Guide.Strong>3. Everyone votes</Guide.Strong> — each person
            selects a card independently; a checkmark shows who has voted
            without revealing values
          </li>
          <li>
            <Guide.Strong>4. Owner reveals</Guide.Strong> — all votes are
            shown simultaneously with statistics (average, median, mode,
            distribution)
          </li>
          <li>
            <Guide.Strong>5. Discuss and re-vote if needed</Guide.Strong>{" "}
            — the owner can reset votes and run another round, or accept
            the result and move to the next story
          </li>
        </Guide.UL>

        <Guide.H2>Owner controls</Guide.H2>
        <Guide.P>
          The session owner has full control over the session:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Add stories</Guide.Strong> — create stories with
            a title and description dialog; stories are listed in the left
            panel
          </li>
          <li>
            <Guide.Strong>Start / stop voting</Guide.Strong> — voting only
            opens when the owner explicitly starts it
          </li>
          <li>
            <Guide.Strong>Reveal votes</Guide.Strong> — show all votes at
            once with statistics
          </li>
          <li>
            <Guide.Strong>Reset votes</Guide.Strong> — clear votes and
            re-open voting for another round
          </li>
          <li>
            <Guide.Strong>Next story</Guide.Strong> — advance to the next
            story in the queue
          </li>
          <li>
            <Guide.Strong>Timer</Guide.Strong> — set a countdown (1, 2, 3,
            or 5 minutes) to keep discussions focused
          </li>
          <li>
            <Guide.Strong>Remove participants</Guide.Strong> — kick a
            voter from the session (they see a &quot;Removed&quot; screen
            and cannot rejoin)
          </li>
          <li>
            <Guide.Strong>Browse stories</Guide.Strong> — click any
            previous story to review its description and results without
            affecting the active voting round
          </li>
        </Guide.UL>
        <Guide.Callout>
          The owner can also vote on stories — they see the same card
          grid as everyone else, plus the owner controls below.
        </Guide.Callout>

        <Guide.H2>Vote results</Guide.H2>
        <Guide.P>
          After votes are revealed, the tool shows:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Distribution bars</Guide.Strong> — a horizontal
            bar chart showing how many people picked each value
          </li>
          <li>
            <Guide.Strong>Average</Guide.Strong> — for numeric scales
            (Fibonacci, Powers of 2)
          </li>
          <li>
            <Guide.Strong>Median and mode</Guide.Strong> — the middle
            value and most common value
          </li>
          <li>
            <Guide.Strong>Per-voter breakdown</Guide.Strong> — each
            participant&apos;s vote with their name
          </li>
        </Guide.UL>

        <Guide.H2>Session management</Guide.H2>
        <Guide.P>
          Sessions are persisted in the database — they survive page
          refreshes and server restarts. The landing page shows all your
          previously created sessions with:
        </Guide.P>
        <Guide.UL>
          <li>Session name and code</li>
          <li>Number of online participants</li>
          <li>Number of stories</li>
          <li>
            <Guide.Strong>Disable</Guide.Strong> — temporarily block new
            participants from joining
          </li>
          <li>
            <Guide.Strong>Delete</Guide.Strong> — archive the session
            (soft delete)
          </li>
        </Guide.UL>

        <Guide.H2>Reconnection</Guide.H2>
        <Guide.P>
          If a participant loses their connection (closed tab, network
          issue), they can rejoin within 60 seconds without losing their
          identity or vote. The tool stores a reconnection token in
          localStorage and automatically reconnects with exponential
          backoff.
        </Guide.P>

        <Guide.H2>When to use planning poker</Guide.H2>
        <Guide.UL>
          <li>
            <Guide.Strong>Sprint planning</Guide.Strong> — estimate the
            stories pulled into the upcoming sprint
          </li>
          <li>
            <Guide.Strong>Backlog refinement</Guide.Strong> — size stories
            ahead of time so sprint planning goes faster
          </li>
          <li>
            <Guide.Strong>Remote teams</Guide.Strong> — everyone
            participates from their browser, no shared screen needed
          </li>
          <li>
            <Guide.Strong>New teams</Guide.Strong> — planning poker helps
            build a shared understanding of effort across team members
          </li>
        </Guide.UL>
      </GuideLayout>
    </>
  );
}
