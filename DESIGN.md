# KK Hermes Connect

## 1. Platform
Obsidian native ItemView, Setting, Modal, buttons and CSS variables are the existing component system.
No React, web fonts, remote assets, gradients or application-wide styling.

## 2. Color and type
Inherit Obsidian's light/dark tokens: background-primary, background-secondary, text-normal,
text-muted, text-error, interactive-accent, text-on-accent, background-modifier-border.
Inherit font-interface, font-text-size, font-monospace and radius-s/m.

## 3. Spacing
Use size-4-1 through size-4-6. All actionable touch targets have a 44px minimum.
Use logical inline/block dimensions; min-inline-size:0 on shrinking regions.

## 4. Layout
Layout: ChatView - fixed header and composer around a long conversation -> Obsidian native workspace leaf; scroll owner: .kkh-messages; anti-patterns: document scrolling, fixed viewport widths, automatic scrolling while reading older messages.
Layout: SessionPicker - search above session results -> Obsidian native modal; scroll owner: .kkh-session-results; anti-patterns: hidden search limits, truncated IDs without a full accessible label.
Layout: Settings - native settings rows -> Obsidian PluginSettingTab; scroll owner: Obsidian settings modal; anti-patterns: plugin-owned application shell.

## 5. Components and brief
Chat primary action: send. Priorities: connection/profile/session; conversation and requests; composer.
Required: session source, Slack delivery notice, connection, create/pick/fork, history, send, exact-operation stop, status refresh, approval/clarify, unsupported interaction explanation.
Primitives: native buttons (default, hover, focus-visible, disabled), message article (user/assistant/tool), request form (open/submitting/closed), status line (offline/connecting/recovering/ready/blocked).
Empty state offers connection settings. Errors identify category without raw upstream diagnostics.
Session selection and settings retain native Obsidian keyboard and modal behaviors.

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
