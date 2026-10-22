import { bad, HttpError } from '../http.js';
import { loadProfile, saveProfile, rollover, publicProfile, recheckGoals, progress } from '../economy.js';
import { cleanLook, THEMES } from '../../shared/avatar.js';
import { cleanNickname } from './auth.js';
import { FREEZE_COST, MAX_FREEZES, HOUSE_COLORS } from '../../shared/catalog.js';

const LEVELS = ['Primary school', 'Secondary school', 'Junior college / A-levels', 'Polytechnic / diploma', 'University'];
const STYLES = ['short bullet points', 'worked examples', 'simple analogies', 'question-and-answer format', 'step-by-step explanations'];
const clampInt = (v, lo, hi, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw bad(`${name} must be a whole number from ${lo} to ${hi}.`);
  return n;
};

export function register(r) {
  r.add('PATCH', '/api/profile', ({ db, user, body }) => {
    let goalsChanged = false;
    db.tx(() => {
      const p = loadProfile(db, user.id);
      rollover(p);
      if (body.goals) {
        const g = body.goals;
        const next = {
          focus: clampInt(g.focus ?? p.goals.focus, 0, 600, 'Focus minutes'),
          cards: clampInt(g.cards ?? p.goals.cards, 0, 300, 'Flashcards'),
          quiz: clampInt(g.quiz ?? p.goals.quiz, 0, 200, 'Quiz questions'),
          indep: clampInt(g.indep ?? p.goals.indep, 0, 30, 'Independent tasks'),
        };
        if (!Object.values(next).some((n) => n > 0)) throw bad('Keep at least one daily goal switched on.');
        p.goals = next; goalsChanged = true;
      }
      if (body.prefs) {
        if (body.prefs.level !== undefined) { if (!LEVELS.includes(body.prefs.level)) throw bad('Unknown level.'); p.prefs.level = body.prefs.level; }
        if (body.prefs.style !== undefined) { if (!STYLES.includes(body.prefs.style)) throw bad('Unknown style.'); p.prefs.style = body.prefs.style; }
        if (body.prefs.tz !== undefined) {
          try { new Intl.DateTimeFormat('en', { timeZone: body.prefs.tz }); p.prefs.tz = body.prefs.tz; } catch { throw bad('Unknown time zone.'); }
        }
      }
      if (body.timer) {
        const t = body.timer;
        p.timer = {
          focus: clampInt(t.focus ?? p.timer.focus, 1, 180, 'Focus length'),
          short: clampInt(t.short ?? p.timer.short, 1, 60, 'Short break'),
          long: clampInt(t.long ?? p.timer.long, 1, 90, 'Long break'),
          rounds: clampInt(t.rounds ?? p.timer.rounds, 1, 12, 'Rounds'),
        };
      }
      if (body.nickname !== undefined) p.nickname = cleanNickname(body.nickname);
      if (body.avatar !== undefined) { try { p.avatar = cleanLook(body.avatar); } catch (e) { throw bad(e.message); } }
      if (body.prefs?.theme !== undefined) { if (!(body.prefs.theme in THEMES)) throw bad('Unknown theme.'); p.prefs.theme = body.prefs.theme; }
      if (body.houseColor !== undefined) {
        if (!HOUSE_COLORS.includes(body.houseColor)) throw bad('Unknown colour.');
        p.houseColor = body.houseColor;
      }
      saveProfile(db, p);
    });
    if (goalsChanged) return recheckGoals(db, user.id);
    return { profile: publicProfile(loadProfile(db, user.id)) };
  });

  r.add('POST', '/api/freeze', ({ db, user }) => db.tx(() => {
    const p = loadProfile(db, user.id);
    if (p.freezes >= MAX_FREEZES) throw new HttpError(409, `You can hold up to ${MAX_FREEZES} streak freezes.`);
    if (p.coins < FREEZE_COST) throw new HttpError(402, `You need ${FREEZE_COST - p.coins} more coins.`);
    p.coins -= FREEZE_COST; p.freezes += 1;
    saveProfile(db, p);
    return { profile: publicProfile(p) };
  }));

  r.add('GET', '/api/progress', ({ db, user }) => progress(db, user.id));
}
