"use client";

import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";

import type { AcpTurnActivity } from "@/features/acp-session";
import { controlClass } from "@/shared/ui/control-class";
import { ICON_SIZE } from "@/shared/ui/icon-size";

/**
 * **The Library's conversation, put away.**
 *
 * One chip with two things to say. Shut and quiet it names the destination — the door back to a
 * conversation that already exists (owner, installed app, 2026-09-07: *"after talking with the
 * agent and going back, there is no way to open that agent again"*). Shut **while the agent is
 * still working** it names the step and what that step is touching, because the owner's next
 * report was about exactly that moment: *"if I press X while it is working it should shrink into a
 * small icon in the right-hand area"* (2026-09-08).
 *
 * ## Why the running state is on this chip and not beside it
 *
 * A second small surface would be a second door to one room. This one already stands at the right
 * end of both rows a person can be reading on this screen — the graph's status row and the
 * reader's top row — which is where a put-away right-hand dock belongs, and it already reopens the
 * dock. Adding a resting pill next to it would mean two controls with the same destination, kept
 * in agreement forever, and `.claude/rules/design.md` calls that floating-box soup by name.
 *
 * ## What it must say
 *
 * The step, not merely that there is one. A dot alone says *something* is happening, which is the
 * one fact a person can already guess from having just pressed X on a running turn. So the phase
 * word comes from the shared `agentActivity` catalogue the map and the architecture workbench read
 * — one turn, one vocabulary — and the target beside it is the tool, the page or the request the
 * turn is on. Waiting for approval is the phase that matters most: a permission card behind a shut
 * dock is a turn that will wait forever unless the chip says so.
 *
 * The dot is the transcript's own 6px work dot, under the same rule: an opacity breath under
 * `motion-safe:`, never a glow, a halo or a ring, and one indigo.
 */
export function LibraryConversationDoor({
  activity,
  agentLabel,
  onOpen,
}: {
  /** The running turn behind the shut dock, or `null` between turns. */
  activity: AcpTurnActivity | null;
  /** The runtime that is answering — named in the accessible name, not on the chip face. */
  agentLabel: string;
  onOpen: () => void;
}) {
  const t = useTranslations("library");
  const tActivity = useTranslations("agentActivity");
  const phase = activity ? tActivity(`phase.${activity.state}`) : null;
  const target = activity
    ? activity.toolName ?? activity.ontologySlug ?? activity.summary
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="library-open-conversation"
      data-agent-running={phase ? "true" : undefined}
      aria-label={phase ? t("conversation.runningLabel", { agent: agentLabel, phase }) : undefined}
      className={controlClass({
        shape: "chip",
        tone: "muted",
        hoverInk: "strong",
        className: "flex-none gap-1.5",
      })}
    >
      {phase ? (
        <span
          aria-hidden
          data-testid="library-conversation-running-dot"
          className="size-1.5 flex-none rounded-full bg-[color:var(--color-indigo-accent)] motion-safe:animate-pulse"
        />
      ) : (
        <MessageSquare size={ICON_SIZE.sm} aria-hidden />
      )}
      {/*
        One line, bounded. The target is a tool name or a page path and can run long; a chip that
        grows with it would push the shelf and index controls beside it off their row.
      */}
      <span className="max-w-[14rem] truncate">
        {phase ? (target ? t("conversation.running", { phase, target }) : phase) : t("conversation.open")}
      </span>
    </button>
  );
}
