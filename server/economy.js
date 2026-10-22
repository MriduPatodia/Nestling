// Coins, streaks, daily goals and independence. All rewards are decided here, on the server.
import {
  ACTIONS, TIERS, tierIndex, streakMultiplier, DEFAULT_GOALS, DEFAULT_PREFS, DEFAULT_TIMER,
  STARTING_COINS, HOUSE_COLORS,
} from '../shared/catalog.js';

export function localDay(tz, now = Date.now()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}
const toUtc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (s, n) => new Date(toUtc(s) + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 864e5);
const freshDay = (d) => ({ d, focus: 0, cards: 0, quiz: 0, indep: 0, chest: false });

export function createProfile(db, userId, tz, nickname = '', avatar = null) {
  const prefs = { ...DEFAULT_PREFS, tz: tz || 'UTC' };
  db.run(`INSERT INTO profiles (user_id, nickname, avatar, coins, goals, prefs, timer, day, house_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId, nickname, avatar ? JSON.stringify(avatar) : null, STARTING_COINS, JSON.stringify(DEFAULT_GOALS), JSON.stringify(prefs), JSON.stringify(DEFAULT_TIMER),
    JSON.stringify(freshDay(localDay(prefs.tz))), HOUSE_COLORS[0]);
}

export function loadProfile(db, userId) {
  const r = db.one('SELECT * FROM profiles WHERE user_id = ?', userId);
  if (!r) return null;
  return {
    userId, coins: r.coins, earned: r.earned, indXP: r.ind_xp, streak: r.streak, best: r.best,
    lastDone: r.last_done, freezes: r.freezes, houseColor: r.house_color,
    nickname: r.nickname || '', avatar: r.avatar ? JSON.parse(r.avatar) : null,
    goals: { ...DEFAULT_GOALS, ...JSON.parse(r.goals) }, prefs: { ...DEFAULT_PREFS, ...JSON.parse(r.prefs) },
    timer: { ...DEFAULT_TIMER, ...JSON.parse(r.timer) }, day: JSON.parse(r.day),
  };
}

export function saveProfile(db, p) {
  db.run(`UPDATE profiles SET coins=?, earned=?, ind_xp=?, streak=?, best=?, last_done=?, freezes=?, goals=?, prefs=?, timer=?, day=?, house_color=?, nickname=?, avatar=?
          WHERE user_id=?`, p.coins, p.earned, p.indXP, p.streak, p.best, p.lastDone, p.freezes,
  JSON.stringify(p.goals), JSON.stringify(p.prefs), JSON.stringify(p.timer), JSON.stringify(p.day), p.houseColor, p.nickname, p.avatar ? JSON.stringify(p.avatar) : null, p.userId);
}

/** Move the profile to today's date. Uses streak freezes for missed days. Returns notices. */
export function rollover(p, now = Date.now()) {
  const today = localDay(p.prefs.tz, now);
  if (p.day.d === today) return [];
  const notices = [];
  if (p.lastDone && p.streak > 0) {
    const gap = daysBetween(p.lastDone, today);
    if (gap > 1) {
      const need = gap - 1;
      if (p.freezes >= need) {
        p.freezes -= need; p.lastDone = addDays(today, -1);
        notices.push({ type: 'freeze', text: `Used ${need} streak freeze${need > 1 ? 's' : ''}. Your streak is safe.` });
      } else {
        notices.push({ type: 'streak_lost', text: `Your ${p.streak}-day streak ended. Start a new one today.` });
        p.streak = 0;
      }
    }
  }
  p.day = freshDay(today);
  return notices;
}

export const activeGoals = (p) => Object.entries(p.goals).filter(([, n]) => n > 0);

export function publicProfile(p) {
  const ti = tierIndex(p.indXP);
  return {
    coins: p.coins, earned: p.earned, indXP: p.indXP, tier: ti, tierName: TIERS[ti].name, aiRate: TIERS[ti].aiRate,
    streak: p.streak, best: p.best, multiplier: streakMultiplier(p.streak), freezes: p.freezes, lastDone: p.lastDone,
    goals: p.goals, prefs: p.prefs, timer: p.timer, day: p.day, houseColor: p.houseColor,
    nickname: p.nickname, avatar: p.avatar,
  };
}

const COUNTERS = {
  focus_minute: 'focus', card_recall: 'cards', card_flip: 'cards',
  quiz_correct: 'quiz', quiz_correct_hint: 'quiz', quiz_wrong: 'quiz',
};

/**
 * Pay out an action. Runs in a transaction; returns { rewards, notices, profile }.
 * opts.base overrides the rule's base (used for word-count rewards).
 */
export function award(db, userId, action, opts = {}) {
  return db.tx(() => {
    const p = loadProfile(db, userId);
    const notices = rollover(p);
    const rewards = [];
    applyAward(db, p, action, opts, rewards, notices);
    saveProfile(db, p);
    return { rewards, notices, profile: publicProfile(p) };
  });
}

function applyAward(db, p, action, opts, rewards, notices) {
  const rule = ACTIONS[action];
  if (!rule) throw new Error('Unknown action ' + action);
  const base = opts.base ?? rule.base;
  const day = p.day.d;
  let capped = false;
  if (rule.cap) {
    const n = db.one('SELECT COUNT(*) AS n FROM events WHERE user_id = ? AND day = ? AND action = ? AND coins > 0', p.userId, day, action).n;
    capped = n >= rule.cap;
  }
  const tierBefore = tierIndex(p.indXP);
  const rate = rule.kind === 'ai' ? TIERS[tierBefore].aiRate : 1;
  const coins = capped ? 0 : Math.round(base * rate * streakMultiplier(p.streak));
  const unitsAi = rule.kind === 'ai' ? (rule.aiUnits ?? Math.max(base, 2)) : 0;
  const unitsInd = rule.kind === 'ind' && !capped ? base : 0;

  p.coins += coins; p.earned += coins; p.indXP += unitsInd;
  if (COUNTERS[action]) p.day[COUNTERS[action]] += 1;
  if (unitsInd > 0) p.day.indep += 1;
  db.run('INSERT INTO events (user_id, day, action, kind, coins, units_ai, units_ind, ref, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    p.userId, day, action, rule.kind, coins, unitsAi, unitsInd, opts.ref ?? null, Date.now());
  if (coins > 0 || base > 0) rewards.push({ action, label: rule.label, coins, capped, kind: rule.kind });

  const tierAfter = tierIndex(p.indXP);
  if (tierAfter > tierBefore) notices.push({ type: 'tier', text: `You reached ${TIERS[tierAfter].name} independence. New items are unlocked.`, tier: tierAfter });

  checkChest(db, p, rewards, notices);
}

function checkChest(db, p, rewards, notices) {
  const day = p.day.d;
  const goals = activeGoals(p);
  if (p.day.chest || !goals.length || !goals.every(([k, n]) => p.day[k] >= n)) return;
  p.day.chest = true;
  p.streak = p.lastDone === addDays(day, -1) ? p.streak + 1 : (p.lastDone === day ? p.streak : 1);
  p.lastDone = day; p.best = Math.max(p.best, p.streak);
  notices.push({ type: 'chest', text: `All goals done. Day ${p.streak} streak! Coins now earn ×${streakMultiplier(p.streak).toFixed(1)}.`, streak: p.streak });
  applyAward(db, p, 'chest', {}, rewards, notices);
}

/** Re-check goals after the goals themselves change (e.g. a goal was lowered). */
export function recheckGoals(db, userId) {
  return db.tx(() => {
    const p = loadProfile(db, userId);
    const notices = rollover(p);
    const rewards = [];
    checkChest(db, p, rewards, notices);
    saveProfile(db, p);
    return { rewards, notices, profile: publicProfile(p) };
  });
}

/** Last 7 days of independent vs AI-assisted work, plus recent coin log. */
export function progress(db, userId) {
  const p = loadProfile(db, userId);
  const today = localDay(p.prefs.tz);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rows = db.all(`SELECT day, SUM(units_ai) AS ai, SUM(units_ind) AS ind, SUM(coins) AS coins FROM events
                       WHERE user_id = ? AND day >= ? GROUP BY day`, userId, days[0]);
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const week = days.map((d) => ({ day: d, ai: byDay[d]?.ai || 0, ind: byDay[d]?.ind || 0, coins: byDay[d]?.coins || 0 }));
  const log = db.all(`SELECT action, kind, coins, created_at FROM events WHERE user_id = ? AND (coins > 0 OR units_ai > 0)
                      ORDER BY id DESC LIMIT 40`, userId)
    .map((r) => ({ ...r, label: ACTIONS[r.action]?.label || r.action }));
  return { week, log };
}
