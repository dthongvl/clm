---
date: 2026-05-09
topic: ai-pr-review-stepper-guide
---

# AI PR Review Stepper Guide

## Summary

A manually-triggered, AI-generated **Review Stepper** in CLM's side panel that walks a cold reviewer through a PR group-by-group — opening with a synthesized PR overview, advancing along an AI-recommended reading order with per-step "what to look at" notes, and surfacing items the AI couldn't decide as persistent "needs your judgment" comment threads.

---

## Problem Frame

When a reviewer opens an unfamiliar PR in CLM, the existing AI surfaces only partially close the orientation gap. The intelligent grouping shows per-group descriptions but loses the **overall PR overview** — the reviewer cannot tell at a glance what this PR is, why it exists, or how the pieces fit. Neither grouping nor the AI review summary tells the reviewer **where to start** or what reading order would be most efficient. And the AI review summary surfaces issues from the AI's perspective — what *the AI* thinks is wrong — which is structurally unable to capture the cases that matter most for human review: places where the AI lacks context, requires implicit team knowledge, or where a product or business judgment is needed.

The pain is concentrated at the **first-open / blank-page moment**: the reviewer wants to start, but has no narrative thread to pull on, no recommended path through the diff, and no compact list of decisions the AI is explicitly handing off to them. AI cost is also a real concern — running a guide-generation pass on every PR open would be wasteful for PRs the reviewer ends up handling without AI help.

---

## Actors

- A1. **Cold reviewer** — opens a PR they did not write (or wrote long enough ago that it feels unfamiliar). Wants orientation, a starting point, and a clear handoff of items needing their judgment.
- A2. **Guide-generation AI** — produces the overview, reading route, per-step notes, and "needs your judgment" threads. Selected per-generation by the reviewer from CLM's existing model configuration.

---

## Key Flows

- F1. **First-time guide generation**
  - **Trigger:** Reviewer clicks "Generate review guide" in the side panel.
  - **Actors:** A1, A2.
  - **Steps:**
    1. Reviewer optionally selects a model from the picker adjacent to the button.
    2. Reviewer clicks generate; the side panel transitions to the during-generation progress state.
    3. AI produces an overview, an ordered list of steps (one per file group), per-step "what to look at" notes, and AI-anchored "needs your judgment" threads on specific lines.
    4. **On success:** side panel transitions from progress to the stepper, landing the reviewer on Step 0 (PR Overview).
    5. **On failure** (network error, timeout, partial output): side panel reverts to the CTA state with an error message and retry affordance; any partial output is discarded.
  - **Outcome:** On success, the stepper is populated; the reviewer can advance step-by-step or navigate freely. On failure, the reviewer can retry without refreshing the page.
  - **Covered by:** R1, R2, R3, R4, R5, R6, R7, R10, R11, R16.

- F2. **Stepping through a guided review**
  - **Trigger:** Reviewer advances from one step to the next.
  - **Actors:** A1.
  - **Steps:**
    1. Reviewer reads the current step's group context and "what to look at" notes.
    2. Diff viewer focuses the file group for the current step.
    3. Reviewer reviews the code; addresses any "needs your judgment" threads anchored within the group (resolve, reply, pin, or leave for later).
    4. Reviewer marks the step "reviewed" and advances.
  - **Outcome:** Step is checked; progress indicator updates.
  - **Covered by:** R8, R9.

- F3. **Off-route navigation**
  - **Trigger:** Reviewer clicks a file in the file tree that is not the current step's group.
  - **Actors:** A1.
  - **Steps:**
    1. Diff viewer navigates to the chosen file.
    2. Stepper marks the current step card with a muted "off-route" indicator and surfaces a "Return to recommended step" affordance; nothing is blocked.
    3. Reviewer can click the return affordance at any time to re-sync the diff viewer to the current step's group.
  - **Outcome:** Free navigation succeeds without losing stepper progress; reviewer has a one-click return path.
  - **Covered by:** R10.

- F4. **Re-generating the guide**
  - **Trigger:** Reviewer chooses to regenerate (e.g., to try a different model).
  - **Actors:** A1, A2.
  - **Steps:**
    1. A modal dialog appears showing the count of unresolved AI-created threads about to be discarded and the list of pinned threads that will be preserved; reviewer must explicitly confirm.
    2. Unresolved unpinned AI-created "needs your judgment" threads are discarded; resolved threads, pinned threads, and reviewer-authored comments are preserved.
    3. New guide is generated as in F1.
  - **Outcome:** A fresh guide replaces the prior one without losing reviewer-authored review state or pinned context.
  - **Covered by:** R14, R15, R18.

---

## Requirements

**Generation and trigger**
- R1. Guide generation is **manually triggered** by the reviewer; it does not run automatically on PR load.
- R2. The trigger surface includes a model picker that **mounts CLM's existing model-selection primitive** (e.g., the picker exposed in `packages/client/src/components/side-panel/action-settings-popover.tsx`) — no new model-management UI.
- R3. **Pre-generation state.** Before generation, the side panel shows a CTA state (with the trigger button and model picker) in place of the stepper, indicating the guide is available on demand.
- R4. **During-generation and failure states.** While generation is in progress, the side panel shows a visible progress state. On generation failure, the side panel reverts to the CTA state with an error message and retry affordance; partial output is discarded.

**Stepper structure and content**
- R5. The guide opens with a **Step 0: PR Overview** containing a synthesized "what this PR is and why" narrative.
- R6. Subsequent steps map to **groups of related files**, not strictly one file per step.
- R7. Each step includes a one-line rationale for **why this group is read at this position** in the route, plus per-step "what to look at" notes.
- R8. Each step has a **"reviewed" check** so cumulative progress is visible at all times.
- R16. **Minimum viable guide for trivial PRs.** When the AI produces zero or one substantive steps beyond Step 0 (single-file PR, rename-only, doc-typo), the stepper renders Step 0 plus any single step inline without a step-progression UI, and surfaces a one-line note explaining the small change shape.

**Navigation and integration with diff view**
- R9. Advancing through steps drives the diff viewer to focus the current step's file group.
- R10. The route is a **recommendation, not a rail**: clicking any file in the file tree directly is allowed and marks the stepper as "off-route" (shown via a muted indicator on the current step card with a "Return to recommended step" affordance) without blocking.
- R11. **Coexistence with intelligent grouping (v1).** Pre-generation, the side panel shows the existing intelligent grouping; once a guide is generated, the stepper takes its place. Full absorption of intelligent grouping is deferred until the stepper's grouping output is validated against real PRs. The AI review summary stays separate and unchanged.

**"Needs your judgment" items**
- R12. The AI emits "needs your judgment" items for cases it cannot decide — missing context, implicit team or product knowledge, or judgment-laden choices — anchored to specific lines.
- R13. These items are created as **persistent comment threads** that behave like normal review comments thereafter: resolvable, repliable, and included in the final review submission. AI-created threads carry a **persistent visual marker** (e.g., an AI-source badge with "AI · needs your judgment" label) that survives resolution and is visible to all readers of the submitted review.
- R17. **Precision floor.** The AI emits "needs your judgment" items only for cases requiring concrete human context, team knowledge, or product judgment. Routine uncertainty (magic numbers with no team-intent ambiguity, naming choices, mechanical conventions) does not qualify. Density is bounded so threads do not flood the review — the prompt design includes an upper-bound heuristic per K lines changed and a discrimination rubric distinguishing "needs human context" from "AI is hedging."

**Re-generation**
- R14. Re-generation is supported. Confirmation is a **modal dialog** showing the count of unresolved AI-created threads about to be discarded plus the list of pinned threads that will be preserved; the reviewer must explicitly confirm to proceed.
- R15. On re-generation, **unresolved AI-created** "needs your judgment" threads are discarded **except those the reviewer has pinned**; resolved threads, pinned threads, and reviewer-authored comments are preserved.
- R18. **Pin to preserve.** Reviewers can pin individual "needs your judgment" threads (resolved or unresolved) to preserve them across re-generation.

**Configuration persistence**
- R19. **Model picker persistence.** The model picker selection is sticky across PRs as a user preference, defaulting to CLM's configured default. A per-generation override becomes the new default until changed again.

---

## Acceptance Examples

- AE1. **Covers R1, R3.** Given a reviewer has just opened a PR in CLM, when no guide has been generated, the side panel shows a "Generate review guide" CTA in place of the stepper, and no AI cost has been incurred for guide generation.
- AE2. **Covers R10.** Given a generated guide is on Step 2 (group "auth middleware"), when the reviewer clicks an unrelated file in the file tree, the diff viewer navigates to that file and the stepper indicates "off-route" with a muted current-step indicator and a "Return to recommended step" affordance; clicking the affordance returns the diff viewer to Step 2's group.
- AE3. **Covers R12, R13, R17.** Given the AI flagged a business-logic branch as "needs your judgment" because it cannot tell whether the new fallback path matches the team's intended customer-tier behavior, when the reviewer replies "confirmed with product, intentional" and resolves the thread, that thread is preserved as part of the submitted review and remains identifiable as AI-created via its persistent badge.
- AE4. **Covers R14, R15, R18.** Given the reviewer has pinned 3 unresolved judgment threads and regenerates with a different model, when the confirmation modal shows "5 unresolved threads will be discarded; 3 pinned threads will be preserved" and the reviewer confirms, the 3 pinned threads remain after generation and the 5 unpinned threads are gone.
- AE5. **Covers R4 / F1 failure path.** Given the reviewer clicked generate and the model call timed out, when generation fails, the side panel shows an error message and reinstates the CTA so the reviewer can retry without refreshing the page.
- AE6. **Covers R16.** Given a single-file PR with a rename-only change, when the reviewer generates the guide, the stepper renders Step 0 (PR overview) plus one inline step without a multi-step progression UI, and surfaces a one-line note that the change shape is trivial.

---

## Success Criteria

- A reviewer opening a cold PR can answer "what is this PR, where do I start, and what does the AI need me to decide?" within the first minute of using the guide, without bouncing between unrelated panels.
- "Needs your judgment" threads measurably surface decisions the AI review summary did not — i.e., the two surfaces produce visibly different content rather than overlapping summaries.
- Judgment threads achieve a non-trivial reviewer-action rate (replies, resolutions with context, or escalations) — measured post-launch, not just emission count. Persistent low action rate signals the precision floor (R17) needs tightening.
- The reviewer can complete a full review using only the stepper as their navigation primitive, without falling back to ad-hoc file-tree clicking, while still being free to do so when desired.
- AI cost is incurred only when the reviewer explicitly requests guide generation; no PR opens trigger a generation pass.
- Planning (`ce-plan`) can proceed without re-deciding what triggers generation, what a step contains, how off-route navigation behaves, what happens to threads on re-generation, or where the surface lives.

---

## Scope Boundaries

- PR-author self-review flow ("here's what your reviewer will ask").
- Mid-review stuck-reviewer rescue ("you've been on this file 10 minutes — want a hint?").
- Static briefing card (Approach A) and inline-annotation (Approach C) variants of the guide.
- Replacing or restructuring the existing AI review summary.
- Cross-PR memory ("you reviewed something similar last week").
- Customizing the AI's reading-order heuristic via user settings.
- Adding new model providers or any model-management UI beyond what CLM already exposes.
- Changing CLM's existing AI backend wiring (OpenCode integration) beyond invoking it for a new prompt.
- **Full absorption of intelligent grouping in v1** — coexistence per R11; absorption deferred until stepper grouping is validated.

---

## Key Decisions

- **Approach B (interactive stepper) chosen over Approach A (static briefing) and Approach C (distributed augmentation):** the cold-open moment benefits from a single coherent surface that propels the review, and per-step "what to look at" notes are most useful adjacent to the lines they concern.
- **Stepper coexists with intelligent grouping in v1, rather than absorbing it:** absorbing grouping was considered but defers to a follow-on iteration after stepper validation, to avoid regressing non-cold-review users (warm reviewers, scanners, PR authors skimming) who rely on grouping today.
- **"Needs your judgment" is a first-class, persistent element — not folded into AI review summary:** the two surfaces answer structurally different questions ("what does the AI think is wrong" vs "what is the AI handing off to a human"); merging them collapses that distinction.
- **AI-created judgment threads are visually distinct from human comments:** a persistent AI-source badge preserves provenance for both reviewer and PR author, supporting the "what AI hands off to human" distinction in the submitted review.
- **Manual trigger with model picker over automatic generation on PR load:** preserves AI cost control and lets the reviewer match model capability to PR difficulty. The discoverability/timing risk is accepted in v1; if generation rate or first-minute outcomes underperform, a tiered model (auto Step 0 + manual full guide) is reachable in v2.
- **Route is a recommendation, not a rail:** rigid step gating would alienate experienced reviewers who often have their own scan patterns; the stepper's value is orientation, not enforcement.
- **Re-generation discards unresolved AI-created threads but preserves resolved, pinned, and reviewer-authored ones:** treats AI-emitted unresolved items as ephemeral guide artifacts while protecting human review work, with pin-to-preserve as the escape hatch when the reviewer has engaged but not yet resolved.
- **Re-generation confirmation is a modal with disclosed counts:** destructive actions with quantifiable scope warrant explicit count disclosure; pairs with pin-to-preserve to give a complete preserve-or-discard choice at confirmation.

---

## Dependencies / Assumptions

- CLM already exposes AI model configuration usable by the guide-generation trigger via the existing model-selection primitive (`action-settings-popover.tsx`); this feature reuses it without extending it.
- The existing intelligent-grouping pipeline can remain in place for the pre-generation state under R11 coexistence; the guide-generation pass produces its own groupings for stepper display.
- OpenCode (the existing AI backend per `README.md`) can host the new prompt / generation call without architectural changes to how CLM invokes AI features.

---

## Outstanding Questions

### Resolve Before Planning

- [Affects R12, R13][User decision] Verify that comment threads in CLM support programmatic AI-source creation, anchoring to specific lines, persistent visual markers (R13 badge), and inclusion in submitted reviews. **If support is missing**, scope v1 "needs your judgment" as a non-persistent in-stepper list and promote persistent thread integration to a follow-on requirement gated on comment-system readiness. The data-layer distinction between AI-created vs reviewer-authored and resolved vs unresolved (also required by R15) is part of this verification.

### Deferred to Planning

- [Affects R6, R11][Technical] How does the guide-generation pass produce its groupings — does it call the existing intelligent-grouping logic, replace it, or run its own pass? Affects whether grouping code is shared, refactored, or duplicated.
- [Affects R12, R13][Technical] What is the wire format for "needs your judgment" threads emitted by the AI — does it reuse the existing comment-thread schema directly, or does it need a `source: ai-guide` marker for the re-generation discard rule in R15?
- [Affects R4][Technical] How is generation progress streamed to the side panel — does CLM already have a streaming pattern for AI features (e.g., the AI progress panel) that the guide can reuse?
- [Affects R9, R10][Technical] What is the right primitive in the diff panel for "focus this file group" and "mark off-route" — does the existing diff-panel context support this, or is a new selection mode needed?
- [Affects R17][Needs research] What is the right density rubric and upper-bound heuristic for judgment-thread emission? Likely requires prompt-design experimentation against real PRs.
- [Affects R13][Technical] Is there an established AI-source visual treatment elsewhere in CLM (e.g., for AI review summary), or is the badge a new pattern this feature establishes?
- [Affects R14][Technical] Does CLM's existing side panel have an established destructive-action confirmation pattern (modal style, copy conventions) that R14's modal should inherit?

---

## Deferred / Open Questions

### From 2026-05-09 review

The following P2 items were surfaced by document review and deferred for planning to evaluate. Each names a real concern that did not block requirements completion but should be considered before or during planning.

- **[P2 error] Success criterion "complete a full review using only the stepper as their navigation primitive" is in tension with R10's "recommendation not rail" stance.** A reviewer who appropriately mixes the stepper with file-tree exploration would, by this criterion, be a failure. *Suggested resolution:* replace with "reviewers who generate a guide complete orientation faster than reviewers who do not" or "judgment threads have a non-trivial reviewer-action rate." *(product-lens + adversarial)*

- **[P2 omission] Strategic positioning is implicit.** The stepper is a positioning bet (toward novice/cold-reviewer scaffolding, away from expert-reviewer issue-surfacing density) treated as a tactical UI choice. If CLM's user base skews experienced, the stepper risks feeling like training wheels. *Suggested resolution:* add an explicit positioning statement — who CLM optimizes for and how the stepper coexists with the issue-surfacing identity. *(product-lens)*

- **[P2 omission] No "what we'd see if this is wrong" inversion analysis.** Pain is hypothesized from the surfaces' shape, not observed. No leading indicators are mandated. *Suggested resolution:* list observable failure modes (low generation rate, low judgment-thread reply rate, complaints from grouping-only users) and what the team will measure post-launch. *(product-lens)*

- **[P2 omission] Step 0 PR Overview may paraphrase the PR description without adding signal.** R5 doesn't specify what the overview must add over the description. *Suggested resolution:* make R5 prescriptive — overview must add cross-file dependencies, change-shape inference from the diff, or the "spine" of the change. Add an AE distinguishing useful synthesis from paraphrase. *(adversarial)*

- **[P2 omission] Step 0 dismissability and persistence not addressed.** Always-on? Collapsible? One-time splash? *Suggested resolution:* clarify whether Step 0 is a permanent first entry, a collapsible header, or a dismissed splash; specify whether advancing past it counts as "reviewed." *(design-lens)*

- **[P2 omission] Progress indicator design unspecified.** Linear bar, per-step checkmarks, fraction counter, or combination? Each produces meaningfully different IA. *Suggested resolution:* specify form and location at requirements level. *(design-lens)*

- **[P2 omission] "What to look at" notes have no quality constraint.** Without a bar, the AI may emit "check for edge cases" generic content. *Suggested resolution:* add quality constraint to R7 — notes must reference specific symbols, line ranges, or named decisions; generic checklist items are out of scope. Include a negative AE. *(design-lens)*

- **[P2 omission] Accessibility / keyboard navigation absent.** Stepper has multiple interactive controls; nothing on keyboard ops, focus management, or screen-reader announcements. *Suggested resolution:* add a requirement covering full keyboard operability, focus placement on step transitions, and live-region progress announcements. *(design-lens)*

### Notes (FYI from review)

- **Model picker may be over-scoped for v1** — could ship v1 with default model only and add the picker after validated need. Kept in scope (R2, R19) per current product direction. *(scope-guardian)*
- **R10 / F3 off-route may be over-scoped** — purely defensive UI; could be removed without breaking navigation behavior. Kept per design-lens recommendation. *(scope-guardian)*
- **R6 "groups of related files" is undefined** — group cardinality and heuristics not specified; planning may need clarification. *(coherence)*
- **AE2 doesn't validate "nothing blocked"** — minor; could add a return-to-step assertion. Partially addressed by AE2 update covering the return affordance. *(coherence)*
- **Manual trigger may fire late** — reviewer dives in, clicks around, then generates a route from a partially-explored state. Discoverability/timing risk accepted in v1 per Key Decisions. *(adversarial)*
- **CTA state content not specified beyond button + picker** — what copy/scope info appears in pre-generation panel. *(design-lens)*
