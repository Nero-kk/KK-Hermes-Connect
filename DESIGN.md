# KK Hermes Connect

## 1. Platform
Obsidian native ItemView, Setting, Modal, buttons and CSS variables are the existing component system.
No React, web fonts, remote assets, gradients or application-wide styling.

## 2. Color and type
Inherit Obsidian's light/dark tokens: background-primary, background-secondary, text-normal,
text-muted, text-error, interactive-accent, text-on-accent, background-modifier-border.
Inherit font-interface, font-text-size, font-monospace and radius-s/m.

## 3. Spacing
Use size-4-1 through size-4-6. The 0.6.0 screenshot brief explicitly requests compact icons: 14px glyphs, 26px desktop toolbar targets and 32px mobile toolbar targets (above the 24px accessibility minimum). Settings keep native sizes.
Use logical inline/block dimensions; min-inline-size:0 on shrinking regions.

## 4. Layout
Layout: Screenshot revision (0.7.0) - clickable session title above history; quota on the left of the toolbar above the composer; hover/focus jump-to-latest immediately above that toolbar; context meter next to model trigger; local avatar before assistant name. Conversation remains the history scroll owner. Settings use a native collapsed details section with searchable, ordered rows and a five-row scrolling viewport. Model popup preserves the model/reasoning columns and remains open through model acknowledgment, closing after reasoning selection. Required: captured custom defaults and independent reset; configured placeholder/input font; actual session.stats context telemetry; connected note save receipts and original backup. Compact density follows the supplied screenshots and native theme tokens.
Layout: Compact composer (0.6.0) - no conversation heading or connection button; connect on plugin layout readiness for registered devices. Show connection errors/progress and source notices above history; put new-tab, new-conversation, history, fork and settings icons immediately above the note tray. The native new-tab action mirrors the current shared Hermes conversation. Use the existing native workspace for tab movement/closing. No synthetic independent conversation tabs. The @ picker uses filename then path and a bounded list above the composer; only a user-chosen Markdown note is read. It pins one reference until removed/replaced. The mobile quota footer shows one icon with an upward details popup; desktop shows inline windows. Body/UI sizes use per-platform steps, 2px each, default -2 with a 10px minimum. Focus styling moves from the inner textarea to the containing input box.
Layout: Claudian composer reference (0.5.0) - note filename and remove action above a rounded input; selected-line chip inside; provider icon, model and reasoning bottom-left; server permission indicator bottom-right; remaining percentage and reset duration below. The model popup opens upward with provider rail, curated models, and reasoning column. Scroll owners: conversation, popup columns, settings model list. Typography uses native font-ui-small/medium and text-normal/muted. Desktop controls are compact; mobile targets remain 44px. Permission label reflects server authority and does not imply a local override. Native selects remain the internal change controls; the popup forwards to their existing handlers.
Layout: ChatView - fixed header and composer around a long conversation -> Obsidian native workspace leaf; scroll owner: .kkh-messages; anti-patterns: document scrolling, fixed viewport widths, automatic scrolling while reading older messages.
Layout: Compact chat revision - compact header toolbar, content-only history and one-line composer -> existing native leaf; scroll owner: .kkh-messages; anti-patterns: visible internal session IDs, empty speaker-only rows, persistent success boilerplate, excess bottom padding.
Layout: Execution selectors - model and reasoning below the message input -> two native selects in a wrapping composer row; scroll owner: .kkh-messages; anti-patterns: sending settings as chat text, hiding an unapplied selection, horizontal overflow from long model names.
Layout: Note context - compact reference toggle, source label and preview above the input -> wrapping native composer row; scroll owner: .kkh-messages, with a bounded expanded history reference; anti-patterns: hidden attachments, losing a selection on chat focus, reading every note on cursor movement, automatic transmission before Send.
Layout: SessionPicker - search above session results -> Obsidian native modal; scroll owner: .kkh-session-results; anti-patterns: hidden search limits, truncated IDs without a full accessible label.
Layout: Settings - native settings rows -> Obsidian PluginSettingTab; scroll owner: Obsidian settings modal; anti-patterns: plugin-owned application shell.
Layout: Environment profile - editable environment fields and JSON transfer -> Obsidian native modal; scroll owner: .modal-content; anti-patterns: nested fixed-height forms, credential export, silently applying a selected file before validation.

## 5. Components and brief
Chat primary action: send. Priorities: connection/profile/session; conversation and requests; composer.
Execution settings apply immediately to the selected conversation through revision-fenced Hermes control RPCs. Show only server-provided model choices and acknowledged values. Disable while disconnected, loading, changing, or generating a reply. Display applying, applied, refused and confirmation states; preserve the draft. The server's model-selection confirmation remains explicit. Other conversations and profile defaults are not rewritten.
Required: session source, Slack delivery notice, connection, create/pick/fork, history, send, exact-operation stop, status refresh, approval/clarify, unsupported interaction explanation.
Primitives: native buttons (default, hover, focus-visible, disabled), message article (user/assistant/tool), request form (open/submitting/closed), status line (offline/connecting/recovering/ready/blocked).
Empty state offers connection settings. Errors identify category without raw upstream diagnostics.
Session selection and settings retain native Obsidian keyboard and modal behaviors.
Environment primary action: apply the complete validated profile. Priorities: connection identity; paths and reference IDs; import/export. File selection previews fields, and Apply saves once. Export uses a user-selected vault-relative private JSON filename and refuses to overwrite existing files. Tokens and pending requests are never portable profile fields.
Selected file contents remain in the JSON textarea so Preview can run again. Empty JSON and missing registration codes explain the next action. Registered devices offer connection testing and explicit re-registration. Chat keeps a described conversation branch action and uses automatic status refresh instead of a duplicate toolbar button.

## 6. Input and accessibility
Desktop Enter sends; Shift+Enter inserts a newline; IME composition never sends.
Mobile Enter inserts a newline; only the send button submits.
Visible labels, semantic buttons, role=status for connection, polite streaming announcements,
focus-visible outlines, text wrapping, keyboard access, safe-area padding and no motion.
Floating mobile navigation reserves mobile-toolbar-height plus safe-area-inset-bottom at the leaf bottom.

## 7. Surfaces
Neutral separators and native tonal backgrounds only. No decorative badges or cards inside cards.

## 8. Remote content
Render Markdown tokens into owned DOM nodes with textContent. No innerHTML, images, raw HTML,
Obsidian postprocessors, executable fences, note access, embeds, or automatic network requests.

## 9. Journeys and verification
First use: enter fixed HTTPS endpoint, register this device, test connection.
Daily use: pick existing canonical session, read saved messages, send and inspect tool/request state.
Recovery: refresh snapshot and operation receipts without sending a new prompt.
Device change: register separately; query and stop the same owner's exact operation.
Verify light/dark, 390/768/1440 widths, long content, empty/error/request states and scroll ownership.
Real Android/iPhone/iPad execution remains a separate release criterion; desktop emulation is layout evidence only.
