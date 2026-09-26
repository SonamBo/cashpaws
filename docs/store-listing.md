# Play Store listing copy

## Title (30 characters)

**Recommended:**

```
Cash Paws: Cat Ball Sort
```

24 characters. The title field carries more weight in Play search than anything
else you write, so the two keywords worth spending it on go here.

Alternatives:

```
Cash Paws — Cat Sort Puzzle      (27)
Cash Paws: Money Sort Puzzle     (28)
```

## Short description (80 characters)

**Recommended:**

```
Cat ball sort puzzle with real money stacks. Collect cats, stack cash, level up.
```

79 characters. Leads with the two search terms. (Up to 1.4 it led with the app
being ad-free and offline; that stopped being true when AppLovin arrived in 1.5.)

Alternatives:

```
Sort cash into tubes in this cosy cat puzzle. Ads only if you want them.  (73)
A water sort puzzle made of money, run by cats. Daily tasks and rewards.  (72)
```

## Long description

```
Sort the money. Fill a tube. Watch your net worth climb.

Cash Paws is a cosy sorting puzzle in the ball sort and water sort tradition —
but instead of coloured liquid, you are stacking $1 coins, $10 pieces and $50
notes into glass tubes, watched over by a cat who takes a personal interest in
your finances.

Tap a tube to lift its top coins, tap another to drop them. Gather four of a
kind and the tube banks itself, paying out four times the value straight into a
career total that never resets. Not when you start a new board. Not ever.

BUT THE MONEY KEEPS COMING

Every few turns the flow arrives and drops a coin into every tube with room to
spare. It starts gently. It does not stay gentle. The interval tightens, junk
coins creep in, and a board you had under control fills up while you are still
deciding. The tubes darken to warn you. The countdown turns orange. Then it
lands.

Fill the board completely and you are stuck. Sort every value into its own tube
to dig yourself out, or lose the level and drop back down. There is no timer
here, and no lives to wait for — only the board, the flow, and whether you saw
it coming.

COLLECT THE CATS

Six cats, each unlocked by playing rather than paying. Bank twenty-five tubes.
Survive fifteen drops. Reach level six. Every cat changes the game a little and
in a different direction: one halves the cost of an undo, one warns you an extra
turn before the flow lands, one keeps the flow from ever speeding up. None of
them is simply the best one, so which you wear is a real choice.

ADS ONLY WHEN YOU WANT ONE

Every ad in Cash Paws is your choice. Stuck and short of coins? Watch one for a
free Sort. Can't wait four hours? Watch one to open your Rewards Box early.
Otherwise you will never see one — no pop-ups between levels, no banners over
the board. There are no in-app purchases of any kind, and no account to make.

EVERY DAY SOMETHING NEW

Three daily tasks, with a streak to keep. A Rewards Box every four hours,
holding more coins the further you get. And Bell Quest: beat seven levels in a
row, and split a pile of coins with every cat who makes it to the end.

WHAT YOU GET

• A sorting puzzle in the ball sort and water sort family, with money
• A career total that never resets, and levels that widen the board
• The flow: a rising tide that turns a tidy board into a problem
• Move a whole stack of matching coins in one tap
• Undo and Sort when you are stuck, paid for with coins you earned
• Six cats to unlock, each bending the rules a different way
• Chip sets to collect in the shop
• Daily tasks, a Rewards Box every four hours, and Bell Quest
• Ads only when you choose one; no purchases, no account

If you like ball sort puzzles, water sort games, or just cats sitting near large
amounts of cash, this one is for you.
```

Roughly 2,400 characters, well inside the 4,000 limit.

## A note on how this is built

The three keywords — ball sort, cat game, water sort — appear where they carry
weight: the title, the first line of the short description, and the opening
paragraph and feature list of the long one. They are not repeated beyond that.

Play's policy treats keyword repetition as spam and it can get a listing
demoted or rejected, so the density here is deliberately low. The title does
most of the work; a long description stuffed with "ball sort water sort cat
sort puzzle game" ranks worse than this, not better.

**The strongest line is still not a keyword.** "Ads only when you want one" is
unusual in a genre full of forced interstitials. It is true of 1.5.0: every ad
is a rewarded ad the player chooses. The day an interstitial ships, that line
must go — `test/preflight.js` checks the listing for stale ad-free claims.
