// Character options. Shared so the server can check what the page sends.
export const BASES = { long: ['straight', 'wavy', 'ponytail', 'buns'], short: ['crop', 'curly', 'swept', 'buzz'] };
export const HAIR_STYLE_NAMES = { straight: 'Straight', wavy: 'Wavy', ponytail: 'Ponytail', buns: 'Space buns', crop: 'Crop', curly: 'Curly', swept: 'Side swept', buzz: 'Buzz' };
export const SKIN = ['#FBDCC6', '#F2C29E', '#DFA67C', '#C4845A', '#9A5F3E', '#6B412B'];
export const HAIR_COLORS = ['#2B1D14', '#5A3A22', '#8E5A33', '#C9934F', '#EBCB7E', '#B5452E', '#45486A', '#E9A2C4', '#7FA6E0', '#E8E4DA'];
export const EYES = ['#3B2A1E', '#4A6B8C', '#3E7A52', '#7A5A2E', '#5C4A7A'];
export const CLOTHES = ['#3E9B71', '#4F81BD', '#E07A5F', '#F2C14E', '#8064A2', '#EDEBE4', '#2F3238', '#E39BB6', '#8FB8C9', '#B5733C'];
export const EXTRAS = ['none', 'glasses', 'headband', 'beanie', 'cap', 'bow'];
export const EXTRA_NAMES = { none: 'Nothing', glasses: 'Glasses', headband: 'Headband', beanie: 'Beanie', cap: 'Cap', bow: 'Bow' };

export const DEFAULT_LOOK = { base: 'long', hair: 'wavy', hairColor: HAIR_COLORS[1], skin: SKIN[1], eyes: EYES[0], top: CLOTHES[0], bottom: CLOTHES[6], extra: 'none', blush: true };

/** Returns a clean look object, or throws a message describing what's wrong. */
export function cleanLook(o) {
  if (!o || typeof o !== 'object') throw new Error('Design your character first.');
  const base = o.base in BASES ? o.base : null;
  if (!base) throw new Error('Pick long or short hair.');
  const pickFrom = (v, list, name) => { if (!list.includes(v)) throw new Error(`Unknown ${name}.`); return v; };
  return {
    base, hair: pickFrom(o.hair, BASES[base], 'hair style'), hairColor: pickFrom(o.hairColor, HAIR_COLORS, 'hair colour'),
    skin: pickFrom(o.skin, SKIN, 'skin tone'), eyes: pickFrom(o.eyes, EYES, 'eye colour'), top: pickFrom(o.top, CLOTHES, 'top colour'),
    bottom: pickFrom(o.bottom, CLOTHES, 'bottom colour'), extra: pickFrom(o.extra, EXTRAS, 'accessory'), blush: o.blush === true,
  };
}
export const THEMES = { green: 'Leaf', blue: 'Ocean', purple: 'Lilac', coral: 'Coral', gold: 'Honey', pink: 'Blossom' };
