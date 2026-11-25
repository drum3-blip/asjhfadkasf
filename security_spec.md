# Firestore Security Specification

## 1. Data Invariants
1. **Board & Project Ownership**: Every `Project` (Board) and `Initiative` document has an `ownerId == request.auth.uid` creator with `email_verified == true`.
2. **Per-Project & Direct-Link Sharing (Login-Optional for Link Holders)**:
   - **Direct App Link (`/publicEntry/default`)**: Managed exclusively by the authenticated board owner (`isBoardOwner`). Allows anyone who opens the app URL (`https://oudaisai-project15.ai.studio/`) without logging in to `get` the configured board's `sharedConfig/workspace` and either all initiatives (`accessScope == 'board'`) or selected `initiativeIds` (`accessScope == 'selected'`) with `viewer` or `editor` role. `allow list` on `/publicEntry` is strictly disabled (`false`).
   - **Per-Project Secret Link (`/projectInvites/{inviteId}`)**: An active `link` invite (`inviteType == 'link' && status == 'active'`) can be fetched via exact `get` without signing in, and activates `publicLinkRole` (`'viewer' | 'editor'`) on the target `Initiative` + `hasActiveLinkShare: true` on `sharedConfig/workspace`. Unrelated initiatives on the same board remain inaccessible.
   - **Authenticated Email Invites & Bookmarks**: Email invites still enforce verified email matching (`hasVerifiedEmail()`), and `/users/{uid}/joinedInitiatives` remains strictly private to `uid`.
   - **Owner**: Full control over the board, bureaus, stages, initiatives, public entry settings, invites, members, tasks, notes, and attachments.
   - **Editor (`role == 'editor'`)**: Can read/edit only the shared `Initiative`, its `tasks`, `notes`, and `attachments` (and create tasks/notes/attachments with `ownerId == request.auth.uid` when signed in, or `ownerId == 'guest_link'` when unauthenticated). Cannot modify unshared initiatives, board bureaus/stages, `publicEntry`, or invites.
   - **Viewer (`role == 'viewer'`)**: Strictly read-only `get` access to the shared `Initiative`, its `tasks`, `notes`, `attachments`, and `sharedConfig/workspace`.
3. **Immutable Audit Fields**: `ownerId` and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time` on write.
4. **Strict Schema & Bounds**: All strings enforce exact `.size()` bounds; dates match `^\d{4}-\d{2}-\d{2}$`; IDs match `^[a-zA-Z0-9_\-]+$`; `teams` capped at 20, `teamRefs` at 30, `taskIds` at 150, `noteIds` at 100, `attachmentIds` at 50, `sharedConfig.bureaus` at 30, `sharedConfig.stages` at 20, `unassignedTaskIds` at 100, `publicEntry.initiativeIds` at 100; `progressPercent` bounded `0..100`; `TaskAttachment.dataUrl` capped at 750,000 bytes.
5. **Terminal State Locking**: Once a `FestivalTask` has `status == 'archived'`, no further updates are permitted.
6. **Zero-Cost Query Enforcement & PII Isolation**: Every `allow list` rule evaluates `resource.data` directly against `request.auth.uid` or verified `request.auth.token.email.lower()` without `get()` or `exists()`. Unauthenticated visitors never have `list` permissions anywhere (`get` only via exact IDs).

## 2. Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unverified Email Spoof**: Signed-in user with `email_verified == false` tries to create `/projects/p1` or claim an email invite.
2. **Guest Spoofing Owner UID**: Unauthenticated user tries to create a task/note/attachment with `ownerId: "userA"` instead of `'guest_link'`.
3. **Ghost Field Shadow Write**: Collaborator or guest updates an initiative or task with an extra field `{ isAdmin: true }`.
4. **Guest Hijacking PublicEntry**: Unauthenticated user or non-owner tries to create/update `/publicEntry/default` to point to another board or escalate `role` from `'viewer'` to `'editor'`.
5. **Paused / Revoked Link Access**: Unauthenticated user tries to read or edit an initiative after `/publicEntry/default.status` is set to `'paused'` and `publicLinkRole` is `'none'`.
6. **Cross-Initiative Lateral Access**: Guest enters `init_A` via link and tries `get` on unshared `init_B` or a task belonging to `init_B`.
7. **Viewer Write Mutation**: Guest/member with `viewer` role on `init_A` attempts to update progress, add a note, or upload an attachment.
8. **Unauthenticated Collection Scraping**: Unauthenticated user attempts `list` on `/projects`, `/projectInvites`, `/publicEntry`, `/initiatives`, or `/tasks`.
9. **Invite Enumeration / Email Scraping**: User C attempts to `list` `/projectInvites` containing invites addressed to User B's email.
10. **Immutable Owner Mutation**: Editor updates a task owned by User A trying to change `ownerId` to `'guest_link'` or `'userB'`.
11. **Terminal State & Bounds Tampering**: Editor updates an `'archived'` task, or injects `taskIds` > 150 items or invalid IDs.
12. **Blanket String / DataURL Exhaustion**: Guest or authenticated user injects 5,000-char strings or a 2MB attachment `dataUrl`.
