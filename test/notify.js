#!/usr/bin/env node
/** Reminder rules, tested without a browser. Run: node test/notify.js */
import { nextDaily, boxReminder, questReminder, QUEST_HOUR } from '../www/shell/notify.js';
import * as Q from '../www/shell/quest.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const H = 3600000;
const at = (d, h, m = 0) => { const x = new Date(2026, 8, d, h, m); return x.getTime(); };

/* ---- the daily slot ---- */
ok('morning: 7 pm today', nextDaily(at(10, 9)) === at(10, QUEST_HOUR));
ok('4 pm: 7 pm is only 3h away, so tomorrow', nextDaily(at(10, 16)) === at(11, QUEST_HOUR));
ok('2 pm: today, 5h away', nextDaily(at(10, 14)) === at(10, QUEST_HOUR));
ok('evening: tomorrow', nextDaily(at(10, 21)) === at(11, QUEST_HOUR));

/* ---- the box ---- */
ok('box: at nextAt', boxReminder({ nextAt: at(10, 13) }, at(10, 9)).at === at(10, 13));
ok('box already ready: nothing', boxReminder({ nextAt: at(10, 8) }, at(10, 9)) === null);

/* ---- the quest ---- */
const q = Q.emptyQuest();
ok('locked quest: nothing', questReminder(q, at(10, 9), 300) === null);
Q.sync(q, { now: at(10, 9), level: 8 });
let r = questReminder(q, at(10, 9), 300);
ok('offer: a new quest, naming the prize', r.at === at(10, 19) && /new Bell Quest/.test(r.title) && /3,000/.test(r.body));
Q.start(q, { now: at(10, 9), value: 300, seed: 5 });
Q.advance(q, at(10, 10)); Q.advance(q, at(10, 11));
r = questReminder(q, at(10, 12), 300);
ok('running: step and cats', r.at === at(10, 19) && /step 2 of 7/.test(r.title) && /5 more levels/.test(r.body) && /cats/.test(r.body));
ok('with time left at 7 pm', /38h 00m left/.test(r.body));
// Late on day two: the next 7 pm would be after the end, so 2 hours before it instead.
r = questReminder(q, at(11, 20), 300);
ok('ending before the next slot: 2 hours before', r.at === q.endsAt - 2 * H && /ends in 2 hours/.test(r.title));
ok('too close to the end: nothing', questReminder(q, q.endsAt - H, 300) === null);
for (let i = 0; i < 5; i++) Q.advance(q, at(10, 13 + i));
r = questReminder(q, at(10, 18), 300);
ok('won: claim it', q.status === 'won' && /prize is waiting/.test(r.title));
Q.claim(q);
ok('after claiming: a new one', /new Bell Quest/.test(questReminder(q, at(10, 18), 300).title));

console.log(`Reminder tests: ${pass}/${pass + fails.length} passed`);
if (fails.length) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
