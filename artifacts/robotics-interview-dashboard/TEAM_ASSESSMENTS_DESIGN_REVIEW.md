# Team Assessments — design review

## Direction

Treat assessments as an operational readiness workflow inside Interview, not a standalone survey product. Keep the existing shell and its compact, information-dense workspace feel. Use the source theme: Space Grotesk for interface text, DM Mono for small metadata, teal for primary actions, amber for attention, and the existing semantic HSL tokens so light/dark mode stays coherent. Favor explicit labels and restrained status color over decorative scoring or progress effects.

## Recommended interaction model

Use three distinct role-oriented destinations with one shared assessment identity and visible lifecycle:

1. **Coordinator authoring and lifecycle** — a coordinator list as the entry point, with clear Draft / Published / Paused status, response deadline or timing only when configured, and completion count where applicable. Create/edit in a focused page rather than a cramped modal. Keep a persistent editor header with assessment title, save state, Preview, and a clearly separated Publish or Pause action. Preview is read-only and shows the member-facing experience. Publishing should include a review/confirmation step that states the assessment will become required; pausing should confirm its effect and leave the assessment/results accessible. Preserve a clear return to the list and unsaved-change warning on navigation.
2. **Member inbox and completion** — a concise “Required” inbox section first, with status and due information visible in each row/card; distinguish Not started, In progress, and Submitted using text as well as color. Opening an assessment begins a focused completion view with title, instructions, progress position, and one question at a time or a short continuous form according to length. Provide explicit Save and return / Continue later and Submit actions; submission confirmation must make the terminal state unmistakable. Returning to an in-progress item should resume at the saved point if the product’s persistence supports it; do not imply answers are saved until that is true.
3. **Coordinator results** — make results reachable from the assessment list and the assessment’s lifecycle view. Start with completion count and completion rate, then a compact summary section, then individual responses with respondent identity and submission status. Keep summary and individual response views separate so aggregate findings are not confused with a person’s answer. Offer Export in the results header with an explicit format/contents confirmation only if those choices are supported; show a clear completion or failure message and do not discard the currently viewed results.

Keep lifecycle wording consistent across all three experiences. Paused means members cannot newly complete the assessment; it should not be presented as deleted or as erasing collected responses. Do not introduce reminders, scoring, anonymity, branching, or other survey capabilities absent from the brief.

## Page hierarchy and navigation

- Add **Team assessments** as an Interview section adjacent to Applicants, Interview queue, Attendance, and Big screen in `workspaceNavigation.ts`; preserve the existing visibility filtering pattern.
- Use sibling routes in the existing flat Wouter `<Switch>` and wrap authenticated experience in the current `<Shell>`. Wouter routes are exact, so define every reachable page explicitly and keep a NotFound fallback.
- Suggested route shape: `/team-assessments` for the coordinator list/member inbox; `/team-assessments/:id` for completion or assessment detail; `/team-assessments/:id/edit` for authoring; `/team-assessments/:id/results` for results. If a member inbox needs a distinct route, make it an explicit route rather than relying on a nested parent route. These are route recommendations only; no route or API is currently present in the inspected source.
- Let role/access determine which actions and views appear, but retain the same assessment status and identity across the coordinator and member views. The current shell already has session roles, permission checks, interview-area navigation, and responsive mobile navigation; integrate with those rather than creating a second shell or access model.

## Component boundaries

- **AssessmentNavigationEntry**: interview sidebar item and active state.
- **AssessmentList / AssessmentListItem**: shared identity and status presentation, with role-specific action slots.
- **AssessmentEditor**: title/instructions and question editing surface; keep editor state separate from preview.
- **AssessmentPreview**: reuse the member completion presentation in read-only mode.
- **AssessmentLifecycleActions**: save state, publish/pause confirmations, and unsaved-exit handling.
- **AssessmentInbox**: required/in-progress/submitted groups and their composed empty states.
- **AssessmentCompletion**: question form, progress, save-and-return, submit confirmation.
- **AssessmentResultsHeader / CompletionSummary / ResponseList / IndividualResponse**: separate aggregate and per-person response responsibilities; export control remains in the results header.
- **AssessmentStatusBadge**: shared, text-labeled status mapping with contrast checked in both themes.

These are proposed UI boundaries, not claims about existing components or backend contracts.

## Important states and safe return behavior

- Loading skeletons for list, editor, completion, and results; keep their layout dimensions stable.
- Empty coordinator list with a restrained create-assessment prompt; empty member inbox with a clear “nothing required” state; results empty/not-yet-submitted state that does not look like a failed load.
- Error state with retry for the affected view, preserving local unsaved editor/response input where possible.
- Saving, saved, and save-failed states in the editor and completion view. Never show “Saved” based only on local input.
- Publish/pause pending and confirmed states; disable duplicate submission while a request is pending.
- In-progress completion with an explicit return path and a confirmation before abandoning unsaved work. On return, preserve position and answers only when persistence guarantees it.
- Submitted/paused states with read-only behavior where appropriate; do not make completed responses look editable.
- Results with zero, partial, and complete participation; distinguish “no responses yet” from loading or an error.
- Export pending/success/failure states, keeping filters/view context intact if those are part of the eventual product.

## Accessibility and responsive risks

- Use semantic headings, form labels, fieldsets/legends for grouped questions, native buttons/inputs, and an announced validation summary. Mark required fields in both text and markup; associate errors and help text with inputs.
- All actions need visible keyboard focus and a logical tab order. On dialogs, trap focus, close on Escape only when safe, and return focus to the trigger. Announce autosave/submission/status changes with a polite live region.
- Never communicate status or completion solely through teal/amber/red. Verify contrast against both token themes, including muted text, badges, disabled controls, focus rings, and validation copy.
- On narrow screens, stack editor and preview rather than squeezing a side-by-side canvas; convert dense lists/tables into labeled cards or allow deliberate horizontal scrolling with clear context. Keep primary actions reachable without covering the form, and ensure long question text, names, and responses wrap without creating page-level horizontal overflow.
- Keyboard-only interaction must not depend on drag-and-drop for question order or on color-coded charts for results. If a chart is used, provide a concise textual equivalent.
- Respect reduced-motion preferences; status changes and progress should remain understandable without animation. Test at browser zoom and in both light and dark themes.

## Source-based notes

- `App.tsx` uses a flat Wouter `<Switch>` with each signed-in page wrapped by `<Shell>`; the current routes include Interview, Applicants, queue, attendance, and big screen, but no assessment route.
- `workspaceNavigation.ts` places Interview links in a fixed section list and maps unclassified paths to the Interview area. Add a labeled section link there rather than altering workspace identity.
- The shell already derives coordinator role from session data, applies workspace visibility, and handles mobile navigation; use those established patterns rather than inventing separate navigation.
- `index.css` provides light/dark HSL theme tokens, Space Grotesk and DM Mono, focus-visible patterns, and reduced-motion support. Keep new surfaces token-based rather than introducing hard-coded light-only colors.
- No assessment-specific API, endpoint, data model, or existing component was found in the inspected files. Backend capabilities and persistence semantics need confirmation before specifying behavior that depends on them.
