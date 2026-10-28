# Status comments integration

The implementation in `Resources/Extension/status-comments.js` is original.
Its protocol reference is the public client at
https://github.com/obfx0/msp2/blob/c2bbda2bfbd7e82cf6411a9c523dcc242f5dc4a3/script.js
(functions `loadAllComments` and `deleteComment`). This is an unofficial
reference, not a guarantee of a stable or currently functioning game API.

The reference uses `POST /edgecomments/graphql` at the regional MSP API origin:

- `comments(threadId, entityType: UGC, pageSize, cursor)` returns `comments` and
  `cursor`. Items expose `commentId`, `author`, `text`, `created`, `deleted`, and
  `profile`, including `membership.lastTierExpiry` for the VIP indicator.
- `deleteComment(input: {commentId})` returns `success`.
- GraphQL `variables` must be a JSON object. On 2026-10-28 a credential-free,
  read-only request to the live EU endpoint rejected the reference client's
  recursively encoded string with HTTP 400 / BAD_REQUEST. The same query with
  an object reached authorization (HTTP 200 / UNAUTHENTICATED). This validates
  the request format, not successful access to a signed-in user's comments.
- Errors show the request stage and HTTP/GraphQL/network category without
  exposing bearer tokens, profile IDs, comment content, or raw server bodies.

TAPNOVA obtains the thread ID from the signed-in profile's WAYD attribute and
requires its metadata to have the same `owner` and type `WAYD`. It validates
ownership and the current status again before a deletion batch. Only IDs from
the loaded comment list can be deleted. Session changes, API errors and STOP
interrupt processing. A new read is required after attempting a deletion batch.
There is no automatic retry of mutations.

The msp2tool.lol frontend was also inspected. Its `/api/status-comments` and
`/api/status-comment-delete` endpoints belong to its private proxy; TAPNOVA does
not use them. No external tool code is executed or imported.

Tests: `node scripts/Check-Status-Comments.cjs`. Network traffic is mocked, and
the browser test blocks other HTTP/WebSocket requests. The tests cover selection,
confirmation, pagination, ownership, session changes, partial failures,
cancellation, escaping and mobile layout. No real comments were deleted in tests.

Live acceptance still required: list a consenting user's own status, explicitly
select a disposable comment, confirm the server result, reload the game, and
check the status from a second account. The GraphQL `deleted` field indicates
that deletion may leave a record; this implementation makes no claim of erasing
server history or suppressing tombstones in other clients.

The modal uses public avatar version/face URLs at
`https://cdn.moviestarplanet2.com/avatars/{profileId}/games/j68d/`. These requests
carry no bearer token. Missing avatars fall back to initials, never another
account’s image. The author action reads remaining pages and previews the
complete selected author list before a separate deletion confirmation.
