# Money Sort's own events

Sent with `host.track()`. The main game's events (`board_stuck`,
`stuck_choice`, `sort_used`, `undo_used`) are listed in `docs/ANALYTICS.md`,
from before this file existed. New ones go here.

## The first levels (1.22.0)

| Event | Extra parameters | When |
|---|---|---|
| `auto_rescue` | level, how (`sort`: the board sorted itself; `refill`: sorting couldn't help, fresh coins) | A board jams on a gentle level (Remote Config `gentle_through`, default 10). It replaces `board_stuck` and the stuck card there. |

`sort_used` with how `free` now also counts Sorts on levels where every Sort
is free (`sort_free_through`). Questions: how often the first levels would
have jammed (`auto_rescue` by level), and whether players who saw one keep
going (`level_up` after it).

## Puzzle of the Day (1.20.0)

Every event carries: number (the puzzle's number, #1 = 25 Oct 2026), day
(`monday`…`sunday`, which sets the difficulty), par (the moves allowed).

| Event | Extra parameters | When |
|---|---|---|
| `puzzle_open` | solved (today's already done), tries, streak | The puzzle screen opens. |
| `puzzle_solved` | moves, tries (attempts today, this one included), streak (after this solve), coins (paid, streak bonus included) | Today's first solve. |
| `puzzle_failed` | tries, practice (true when replaying a solved day) | Out of moves. |
| `puzzle_replayed` | moves | Solved again on a day already solved (no reward). |
| `puzzle_share` | kind (`mp4`, `webm`, or `png` where the phone can't record), kb | The share clip is made and handed to the share sheet. |

The shell adds `lobby_button` (id `daily-puzzle`) when the lobby button is
tapped, `share_file` (from `puzzle`) for the clip, and
`earn_virtual_currency` with source `daily-puzzle` for the coins.

Questions these answer: how many lobby visitors open the puzzle
(`lobby_button` / `screen_view` lobby), how many solve (`puzzle_solved` /
`puzzle_open`, by `day`), how many tries a solve takes, whether streaks
build, and how many solvers share.
