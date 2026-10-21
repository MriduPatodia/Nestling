import { COINS } from './settings.js';
// Single source of truth for the game economy and the dream-home catalog.
// Imported by the server (authoritative prices/rules) and the browser (display).

export const ROOM_SIZE = 6;          // rooms are 6x6 tiles
export const WALL_HEIGHT = 112;      // px, in iso space
export const HOUSE_SLOTS = 7;        // 3 floors x 2 rooms + attic
export const ROOM_BUILD_COST = [0, 150, 300, 500, 800, 1200, 1800];
export const SELL_BACK = 0.5;
export const FREEZE_COST = 50;
export const MAX_FREEZES = 3;
export const STARTING_COINS = 150;

export const TIERS = [
  { name: 'Guided', xp: 0, aiRate: 1 },
  { name: 'Growing', xp: 100, aiRate: 0.75 },
  { name: 'Steady', xp: 300, aiRate: 0.5 },
  { name: 'Independent', xp: 700, aiRate: 0.25 },
  { name: 'Self-directed', xp: 1500, aiRate: 0.1 },
];

export const HOME_LEVELS = [
  [0, 'Empty shell'], [250, 'Cosy corner'], [600, 'Starter flat'], [1100, 'Snug home'],
  [1800, 'Family house'], [2800, 'Dream house'], [4200, 'Townhouse'], [6000, 'Manor'], [9000, 'Mansion'],
];

export const tierIndex = (xp) => TIERS.reduce((t, x, i) => (xp >= x.xp ? i : t), 0);
export const streakMultiplier = (streak) => 1 + Math.min(streak, 10) * 0.1;
export const homeLevel = (value) => {
  let i = 0;
  HOME_LEVELS.forEach((l, j) => { if (value >= l[0]) i = j; });
  return { index: i, name: HOME_LEVELS[i][1], next: HOME_LEVELS[i + 1] || null, floor: HOME_LEVELS[i][0] };
};

// kind: ind = independent work, ai = AI-assisted, neutral = neither.
// cap = how many times per day the action pays out (anti-farming).
export const ACTIONS = {
  focus_minute:      { base: COINS.focus_minute,  kind: 'neutral', label: 'Focused minute', area: 'Focus timer', desc: 'Each focused minute' },
  focus_complete:    { base: COINS.focus_session_done,  kind: 'neutral', label: 'Focus session complete', area: 'Focus timer', desc: 'Finishing a focus session' },
  notes_own:         { base: COINS.own_notes_per_8_words,  kind: 'ind', label: 'Wrote your own notes', area: 'Notes', desc: 'Your own notes, per 8 new words (max 40 chunks per save)' },
  notes_ai:          { base: COINS.ai_notes,  kind: 'ai', label: 'AI notes generated', area: 'Notes', desc: 'Generating notes with AI', cap: 10 },
  card_own:          { base: COINS.own_flashcard,  kind: 'ind', label: 'Made a flashcard', area: 'Flashcards', desc: 'Making your own flashcard', cap: 40 },
  cards_ai:          { base: COINS.ai_flashcards,  kind: 'ai', label: 'AI flashcards generated', area: 'Flashcards', desc: 'Generating a deck with AI', cap: 10 },
  card_recall:       { base: COINS.recall_card,  kind: 'ind', label: 'Recalled a card', area: 'Flashcards', desc: 'Typing your answer before flipping, and getting it', cap: 150 },
  card_flip:         { base: COINS.flip_card,  kind: 'neutral', label: 'Reviewed a card', area: 'Flashcards', desc: 'Reviewing a card by just flipping it', cap: 150 },
  quiz_own:          { base: COINS.own_quiz_question,  kind: 'ind', label: 'Wrote a quiz question', area: 'Quiz', desc: 'Writing your own quiz question', cap: 30 },
  quiz_ai:           { base: COINS.ai_quiz,  kind: 'ai', label: 'AI quiz generated', area: 'Quiz', desc: 'Generating a quiz with AI', cap: 10 },
  quiz_correct:      { base: COINS.quiz_correct,  kind: 'ind', label: 'Correct answer', area: 'Quiz', desc: 'Correct answer with no hint', cap: 150 },
  quiz_correct_hint: { base: COINS.quiz_correct_with_hint,  kind: 'ai', label: 'Correct with a hint', area: 'Quiz', desc: 'Correct answer after an AI hint', cap: 150 },
  quiz_wrong:        { base: 0,  kind: 'neutral', label: 'Answered a question', area: 'Quiz', desc: 'Wrong answer (still counts for your daily goal)', hidden: true },
  hint:              { base: 0,  kind: 'ai', label: 'Asked for a hint', area: 'Quiz', desc: 'Asking the AI for a hint', aiUnits: 2 },
  tutor:             { base: 0,  kind: 'ai', label: 'Asked the tutor', area: 'Tutor', desc: 'Chatting with the AI tutor', aiUnits: 2 },
  checkin:           { base: COINS.daily_checkin, kind: 'neutral', label: 'Daily check-in', area: 'Wellbeing', desc: 'Doing your daily check-in (once a day)', cap: 1 },
  journal:           { base: COINS.journal_entry, kind: 'neutral', label: 'Journal entry', area: 'Wellbeing', desc: 'Writing in your journal (once a day)', cap: 1 },
  chest:             { base: COINS.daily_chest, kind: 'neutral', label: 'Daily chest', area: 'Daily', desc: 'Opening the daily chest (all goals done)' },
};

export const DEFAULT_GOALS = { focus: 25, cards: 10, quiz: 5, indep: 1 };
export const DEFAULT_TIMER = { focus: 25, short: 5, long: 15, rounds: 4 };
export const DEFAULT_PREFS = { level: 'Secondary school', style: 'short bullet points', tz: 'UTC', theme: 'green' };

/* ---------------- rooms ---------------- */
export const ROOM_TYPES = {
  bedroom:     { name: 'Bedroom', wallpaper: 'sage', floor: 'oak' },
  study:       { name: 'Study', wallpaper: 'navy', floor: 'walnut' },
  living:      { name: 'Living room', wallpaper: 'linen', floor: 'oak' },
  kitchen:     { name: 'Kitchen', wallpaper: 'tile_white', floor: 'checker' },
  bathroom:    { name: 'Bathroom', wallpaper: 'tile_blue', floor: 'terrazzo' },
  music:       { name: 'Music room', wallpaper: 'blush', floor: 'walnut' },
  library:     { name: 'Library', wallpaper: 'panel', floor: 'walnut', tier: 2 },
  greenhouse:  { name: 'Greenhouse', wallpaper: 'glass', floor: 'terrazzo', tier: 3 },
  observatory: { name: 'Observatory', wallpaper: 'night', floor: 'carpet_blue', tier: 4 },
};

export const WALLPAPERS = {
  sage:       { name: 'Sage paint', price: 0, base: '#B9CDB9', pattern: 'plain' },
  linen:      { name: 'Linen paint', price: 0, base: '#E4DCCB', pattern: 'plain' },
  navy:       { name: 'Ink blue paint', price: 30, base: '#36486B', pattern: 'plain' },
  blush:      { name: 'Blush paint', price: 30, base: '#E8C0BC', pattern: 'plain' },
  stripes:    { name: 'Mint stripes', price: 45, base: '#CFE6D8', alt: '#B4D6C2', pattern: 'stripes' },
  dots:       { name: 'Polka dots', price: 45, base: '#F3E3B5', alt: '#E2B85C', pattern: 'dots' },
  tile_white: { name: 'White tiles', price: 50, base: '#EEF0EE', alt: '#C9D0CC', pattern: 'tiles' },
  tile_blue:  { name: 'Pool tiles', price: 50, base: '#A9D3E3', alt: '#83B6CB', pattern: 'tiles' },
  brick:      { name: 'Exposed brick', price: 70, base: '#B66A4F', alt: '#8E4C37', pattern: 'brick' },
  panel:      { name: 'Wood panelling', price: 90, base: '#8C5E3C', alt: '#6E4529', pattern: 'panel' },
  leaves:     { name: 'Leafy print', price: 110, base: '#DCEBD3', alt: '#6FA86A', pattern: 'leaves', tier: 1 },
  glass:      { name: 'Glass walls', price: 160, base: '#BFE3E6', alt: '#FFFFFF', pattern: 'glass', tier: 3 },
  subway:     { name: 'Subway tiles', price: 55, base: '#F4F4F1', alt: '#C9CDD0', pattern: 'brick' },
  acoustic:   { name: 'Acoustic panels', price: 80, base: '#3B3F4A', alt: '#2C2F38', pattern: 'tiles' },
  night:      { name: 'Starry night', price: 180, base: '#1E2547', alt: '#F7E7A8', pattern: 'stars', tier: 2 },
};

export const FLOORS = {
  oak:         { name: 'Oak planks', price: 0, base: '#C9965E', alt: '#B7834D', pattern: 'planks' },
  walnut:      { name: 'Walnut planks', price: 50, base: '#7B5133', alt: '#6A432A', pattern: 'planks' },
  checker:     { name: 'Checker tiles', price: 60, base: '#F1EEE6', alt: '#2F3A40', pattern: 'checker' },
  carpet_blue: { name: 'Blue carpet', price: 50, base: '#5B76B5', alt: '#5370AE', pattern: 'plain' },
  carpet_rose: { name: 'Rose carpet', price: 50, base: '#C98A98', alt: '#C08190', pattern: 'plain' },
  terrazzo:    { name: 'Terrazzo', price: 80, base: '#E7E2DA', alt: '#C77E62', pattern: 'terrazzo' },
  tatami:      { name: 'Tatami', price: 90, base: '#CFC58F', alt: '#5D6B3A', pattern: 'tatami', tier: 1 },
  bath_tile:   { name: 'Bathroom tiles', price: 45, base: '#DCE9EE', alt: '#A9C6D2', pattern: 'checker' },
  marble:      { name: 'Marble', price: 170, base: '#F2F2F0', alt: '#BFC4CC', pattern: 'marble', tier: 3 },
};

export const HOUSE_COLORS = ['#E9D8B8', '#BFD7C4', '#C9D6EA', '#E9C2B3', '#D9C9E6', '#F2E3A6', '#B9B2A8'];

/* ---------------- furniture ----------------
   layer: floor (blocks tiles), rug (flat, under everything), small (on floor or on a surface), wall
   w x d footprint in tiles (before rotation). h = height in px. surface = height of a top that small items can sit on.
   wall items: w = width along the wall, z = mount height, h = height. */
export const ITEMS = {
  // beds
  bed_single:   { name: 'Single bed', cat: 'beds', price: 60, layer: 'floor', w: 1, d: 2, h: 30 },
  bed_double:   { name: 'Double bed', cat: 'beds', price: 140, layer: 'floor', w: 2, d: 2, h: 30 },
  bed_canopy:   { name: 'Canopy bed', cat: 'beds', price: 320, layer: 'floor', w: 2, d: 2, h: 90, tier: 3 },
  // seating
  chair_desk:   { name: 'Desk chair', cat: 'seating', price: 30, layer: 'floor', w: 1, d: 1, h: 40 },
  armchair:     { name: 'Armchair', cat: 'seating', price: 70, layer: 'floor', w: 1, d: 1, h: 34 },
  sofa:         { name: 'Sofa', cat: 'seating', price: 130, layer: 'floor', w: 2, d: 1, h: 34 },
  beanbag:      { name: 'Beanbag', cat: 'seating', price: 45, layer: 'floor', w: 1, d: 1, h: 20 },
  // tables & storage
  desk:         { name: 'Study desk', cat: 'tables', price: 70, layer: 'floor', w: 2, d: 1, h: 30, surface: 30 },
  table_coffee: { name: 'Coffee table', cat: 'tables', price: 40, layer: 'floor', w: 1, d: 1, h: 14, surface: 14 },
  table_dining: { name: 'Dining table', cat: 'tables', price: 120, layer: 'floor', w: 2, d: 2, h: 30, surface: 30 },
  nightstand:   { name: 'Nightstand', cat: 'tables', price: 35, layer: 'floor', w: 1, d: 1, h: 22, surface: 22 },
  bookshelf:    { name: 'Bookshelf', cat: 'storage', price: 90, layer: 'floor', w: 1, d: 1, h: 80 },
  wardrobe:     { name: 'Wardrobe', cat: 'storage', price: 80, layer: 'floor', w: 1, d: 1, h: 86 },
  dresser:      { name: 'Dresser', cat: 'storage', price: 85, layer: 'floor', w: 2, d: 1, h: 30, surface: 30 },
  counter:      { name: 'Kitchen counter', cat: 'storage', price: 110, layer: 'floor', w: 2, d: 1, h: 32, surface: 32 },
  fridge:       { name: 'Fridge', cat: 'storage', price: 100, layer: 'floor', w: 1, d: 1, h: 88 },
  stove:        { name: 'Stove', cat: 'storage', price: 90, layer: 'floor', w: 1, d: 1, h: 32, surface: 32 },
  bathtub:      { name: 'Bathtub', cat: 'storage', price: 150, layer: 'floor', w: 2, d: 1, h: 24 },
  // decor & hobbies
  plant_tall:   { name: 'Monstera', cat: 'decor', price: 40, layer: 'floor', w: 1, d: 1, h: 60 },
  cactus:       { name: 'Cactus pot', cat: 'decor', price: 20, layer: 'floor', w: 1, d: 1, h: 36 },
  floor_lamp:   { name: 'Floor lamp', cat: 'decor', price: 45, layer: 'floor', w: 1, d: 1, h: 72, light: true },
  cat:          { name: 'Cat & cat bed', cat: 'decor', price: 120, layer: 'floor', w: 1, d: 1, h: 20, tier: 1 },
  guitar:       { name: 'Guitar on stand', cat: 'decor', price: 90, layer: 'floor', w: 1, d: 1, h: 56 },
  easel:        { name: 'Art easel', cat: 'decor', price: 75, layer: 'floor', w: 1, d: 1, h: 64 },
  tv:           { name: 'TV & stand', cat: 'decor', price: 160, layer: 'floor', w: 2, d: 1, h: 58 },
  aquarium:     { name: 'Aquarium', cat: 'decor', price: 200, layer: 'floor', w: 2, d: 1, h: 52, tier: 2, light: true },
  fireplace:    { name: 'Fireplace', cat: 'decor', price: 240, layer: 'floor', w: 2, d: 1, h: 60, tier: 2, light: true },
  piano:        { name: 'Upright piano', cat: 'decor', price: 260, layer: 'floor', w: 2, d: 1, h: 56, tier: 2 },
  telescope:    { name: 'Telescope', cat: 'decor', price: 220, layer: 'floor', w: 1, d: 1, h: 64, tier: 3 },
  // small things (go on desks/tables or the floor)
  lamp_desk:    { name: 'Desk lamp', cat: 'small', price: 25, layer: 'small', w: 1, d: 1, h: 22, light: true },
  laptop:       { name: 'Laptop', cat: 'small', price: 60, layer: 'small', w: 1, d: 1, h: 12 },
  books:        { name: 'Book stack', cat: 'small', price: 12, layer: 'small', w: 1, d: 1, h: 14 },
  succulent:    { name: 'Succulent', cat: 'small', price: 10, layer: 'small', w: 1, d: 1, h: 14 },
  globe:        { name: 'Globe', cat: 'small', price: 30, layer: 'small', w: 1, d: 1, h: 22 },
  mug:          { name: 'Tea mug', cat: 'small', price: 6, layer: 'small', w: 1, d: 1, h: 8 },
  fishbowl:     { name: 'Fishbowl', cat: 'small', price: 40, layer: 'small', w: 1, d: 1, h: 16 },
  candle:       { name: 'Candle', cat: 'small', price: 8, layer: 'small', w: 1, d: 1, h: 12, light: true },
  record:       { name: 'Record player', cat: 'small', price: 70, layer: 'small', w: 1, d: 1, h: 10, tier: 1 },
  trophy:       { name: 'Study trophy', cat: 'small', price: 50, layer: 'small', w: 1, d: 1, h: 20, tier: 2 },
  // bathroom
  toilet:       { name: 'Toilet', cat: 'bathroom', price: 60, layer: 'floor', w: 1, d: 1, h: 34 },
  vanity:       { name: 'Sink vanity', cat: 'bathroom', price: 80, layer: 'floor', w: 1, d: 1, h: 30, surface: 30 },
  shower:       { name: 'Glass shower', cat: 'bathroom', price: 170, layer: 'floor', w: 1, d: 1, h: 92 },
  laundry:      { name: 'Laundry basket', cat: 'bathroom', price: 25, layer: 'floor', w: 1, d: 1, h: 24 },
  bath_mat:     { name: 'Bath mat', cat: 'bathroom', price: 15, layer: 'rug', w: 1, d: 2, h: 0 },
  duck:         { name: 'Rubber duck', cat: 'bathroom', price: 8, layer: 'small', w: 1, d: 1, h: 12 },
  toiletries:   { name: 'Toothbrush & soap', cat: 'bathroom', price: 10, layer: 'small', w: 1, d: 1, h: 14 },
  towel_rack:   { name: 'Towel rail', cat: 'bathroom', price: 30, layer: 'wall', w: 1, z: 36, h: 34 },
  mirror_cab:   { name: 'Mirror cabinet', cat: 'bathroom', price: 55, layer: 'wall', w: 1, z: 52, h: 36 },
  // kitchen
  sink_counter: { name: 'Sink counter', cat: 'kitchen', price: 120, layer: 'floor', w: 2, d: 1, h: 32, surface: 32 },
  island:       { name: 'Kitchen island', cat: 'kitchen', price: 150, layer: 'floor', w: 2, d: 1, h: 32, surface: 32, tier: 1 },
  dining_chair: { name: 'Dining chair', cat: 'kitchen', price: 30, layer: 'floor', w: 1, d: 1, h: 42 },
  bin:          { name: 'Pedal bin', cat: 'kitchen', price: 15, layer: 'floor', w: 1, d: 1, h: 24 },
  fruit_bowl:   { name: 'Fruit bowl', cat: 'kitchen', price: 12, layer: 'small', w: 1, d: 1, h: 12 },
  kettle:       { name: 'Kettle', cat: 'kitchen', price: 18, layer: 'small', w: 1, d: 1, h: 16 },
  toaster:      { name: 'Toaster', cat: 'kitchen', price: 20, layer: 'small', w: 1, d: 1, h: 12 },
  microwave:    { name: 'Microwave', cat: 'kitchen', price: 45, layer: 'small', w: 1, d: 1, h: 16 },
  herbs:        { name: 'Herb pots', cat: 'kitchen', price: 14, layer: 'small', w: 1, d: 1, h: 14 },
  pan_rack:     { name: 'Hanging pans', cat: 'kitchen', price: 40, layer: 'wall', w: 2, z: 56, h: 30 },
  jar_shelf:    { name: 'Jar shelf', cat: 'kitchen', price: 35, layer: 'wall', w: 2, z: 60, h: 22 },
  // bedroom & study extras
  teddy:        { name: 'Teddy bear', cat: 'bedroom', price: 15, layer: 'small', w: 1, d: 1, h: 16 },
  alarm:        { name: 'Alarm clock', cat: 'bedroom', price: 12, layer: 'small', w: 1, d: 1, h: 10 },
  filing:       { name: 'Filing cabinet', cat: 'study', price: 50, layer: 'floor', w: 1, d: 1, h: 30, surface: 30 },
  map_poster:   { name: 'World map', cat: 'study', price: 45, layer: 'wall', w: 2, z: 48, h: 36 },
  certificate:  { name: 'Framed certificate', cat: 'study', price: 30, layer: 'wall', w: 1, z: 54, h: 26, tier: 1 },
  // living room extras
  side_table:   { name: 'Round side table', cat: 'living', price: 35, layer: 'floor', w: 1, d: 1, h: 22, surface: 22 },
  vase:         { name: 'Flower vase', cat: 'living', price: 15, layer: 'small', w: 1, d: 1, h: 18 },
  // music
  drums:        { name: 'Drum kit', cat: 'music', price: 220, layer: 'floor', w: 2, d: 2, h: 40, tier: 1 },
  amp:          { name: 'Amp speaker', cat: 'music', price: 70, layer: 'floor', w: 1, d: 1, h: 34 },
  music_stand:  { name: 'Music stand', cat: 'music', price: 25, layer: 'floor', w: 1, d: 1, h: 48 },
  vinyl_wall:   { name: 'Vinyl display', cat: 'music', price: 50, layer: 'wall', w: 2, z: 52, h: 26 },
  // library
  bookcase:     { name: 'Grand bookcase', cat: 'library', price: 200, layer: 'floor', w: 2, d: 1, h: 96 },
  // greenhouse
  potting_bench:{ name: 'Potting bench', cat: 'greenhouse', price: 90, layer: 'floor', w: 2, d: 1, h: 30, surface: 30 },
  tomato:       { name: 'Tomato plant', cat: 'greenhouse', price: 30, layer: 'floor', w: 1, d: 1, h: 44 },
  sunflower:    { name: 'Sunflowers', cat: 'greenhouse', price: 35, layer: 'floor', w: 1, d: 1, h: 58 },
  garden_bench: { name: 'Garden bench', cat: 'greenhouse', price: 70, layer: 'floor', w: 2, d: 1, h: 30 },
  orchid:       { name: 'Orchid', cat: 'greenhouse', price: 25, layer: 'small', w: 1, d: 1, h: 20 },
  watering_can: { name: 'Watering can', cat: 'greenhouse', price: 12, layer: 'small', w: 1, d: 1, h: 12 },
  seedlings:    { name: 'Seedling tray', cat: 'greenhouse', price: 10, layer: 'small', w: 1, d: 1, h: 8 },
  hanging_plant:{ name: 'Hanging planter', cat: 'greenhouse', price: 30, layer: 'wall', w: 1, z: 66, h: 34 },
  // observatory
  star_map:     { name: 'Star chart', cat: 'observatory', price: 60, layer: 'wall', w: 2, z: 46, h: 40 },
  moon_lamp:    { name: 'Moon lamp', cat: 'observatory', price: 35, layer: 'small', w: 1, d: 1, h: 16, light: true },
  projector:    { name: 'Star projector', cat: 'observatory', price: 55, layer: 'small', w: 1, d: 1, h: 12, light: true },
  // rugs
  rug_round:    { name: 'Round rug', cat: 'rugs', price: 30, layer: 'rug', w: 2, d: 2, h: 0 },
  rug_stripe:   { name: 'Striped rug', cat: 'rugs', price: 45, layer: 'rug', w: 2, d: 3, h: 0 },
  rug_check:    { name: 'Checked rug', cat: 'rugs', price: 60, layer: 'rug', w: 3, d: 3, h: 0 },
  rug_fluffy:   { name: 'Fluffy rug', cat: 'rugs', price: 55, layer: 'rug', w: 2, d: 2, h: 0, tier: 1 },
  // wall
  window:       { name: 'Window', cat: 'wall', price: 50, layer: 'wall', w: 1, z: 40, h: 44 },
  window_big:   { name: 'Big window', cat: 'wall', price: 110, layer: 'wall', w: 2, z: 34, h: 52 },
  poster_wave:  { name: 'Wave poster', cat: 'wall', price: 20, layer: 'wall', w: 1, z: 48, h: 36 },
  poster_planet:{ name: 'Planet poster', cat: 'wall', price: 25, layer: 'wall', w: 1, z: 48, h: 36 },
  painting:     { name: 'Landscape painting', cat: 'wall', price: 80, layer: 'wall', w: 2, z: 50, h: 34 },
  clock:        { name: 'Wall clock', cat: 'wall', price: 35, layer: 'wall', w: 1, z: 62, h: 26 },
  shelf_plants: { name: 'Plant shelf', cat: 'wall', price: 45, layer: 'wall', w: 2, z: 58, h: 26 },
  lights:       { name: 'String lights', cat: 'wall', price: 40, layer: 'wall', w: 2, z: 88, h: 14, light: true },
  mirror:       { name: 'Mirror', cat: 'wall', price: 60, layer: 'wall', w: 1, z: 36, h: 54 },
  corkboard:    { name: 'Corkboard', cat: 'wall', price: 40, layer: 'wall', w: 2, z: 46, h: 34 },
  whiteboard:   { name: 'Whiteboard', cat: 'wall', price: 55, layer: 'wall', w: 2, z: 44, h: 38 },
  neon:         { name: 'Neon "study" sign', cat: 'wall', price: 120, layer: 'wall', w: 2, z: 66, h: 22, tier: 3, light: true },
};

/* ---------------- what each room's shop sells ----------------
   Every room gets BASICS plus its own themed items. Wallpapers/floors listed here are shown first as "suits this room". */
export const BASICS = ['window', 'window_big', 'clock', 'painting', 'plant_tall', 'cactus', 'succulent', 'floor_lamp', 'lights', 'candle', 'cat',
  'rug_round', 'rug_stripe', 'rug_check', 'rug_fluffy'];
export const ROOM_SHOPS = {
  bedroom: { items: ['bed_single', 'bed_double', 'bed_canopy', 'nightstand', 'wardrobe', 'dresser', 'desk', 'chair_desk', 'beanbag', 'armchair',
    'lamp_desk', 'alarm', 'teddy', 'books', 'laptop', 'mug', 'fishbowl', 'trophy', 'mirror', 'poster_wave', 'poster_planet', 'corkboard'],
    wallpapers: ['sage', 'blush', 'dots', 'stripes', 'leaves'], floors: ['oak', 'carpet_rose', 'carpet_blue'] },
  study: { items: ['desk', 'chair_desk', 'bookshelf', 'filing', 'armchair', 'table_coffee', 'lamp_desk', 'laptop', 'books', 'globe', 'mug', 'trophy',
    'easel', 'whiteboard', 'corkboard', 'map_poster', 'certificate', 'neon'],
    wallpapers: ['navy', 'panel', 'linen'], floors: ['walnut', 'oak', 'carpet_blue'] },
  living: { items: ['sofa', 'armchair', 'beanbag', 'table_coffee', 'side_table', 'tv', 'fireplace', 'bookshelf', 'aquarium', 'record', 'vase', 'easel',
    'books', 'mug', 'poster_wave', 'mirror'],
    wallpapers: ['linen', 'stripes', 'brick', 'leaves'], floors: ['oak', 'walnut', 'terrazzo'] },
  kitchen: { items: ['counter', 'sink_counter', 'stove', 'fridge', 'island', 'table_dining', 'dining_chair', 'bin', 'fruit_bowl', 'kettle',
    'toaster', 'microwave', 'herbs', 'mug', 'pan_rack', 'jar_shelf'],
    wallpapers: ['subway', 'tile_white', 'linen'], floors: ['checker', 'terrazzo', 'oak'] },
  bathroom: { items: ['bathtub', 'shower', 'toilet', 'vanity', 'laundry', 'bath_mat', 'duck', 'toiletries', 'towel_rack', 'mirror_cab', 'mirror'],
    wallpapers: ['tile_blue', 'subway', 'tile_white'], floors: ['bath_tile', 'terrazzo', 'marble'] },
  music: { items: ['piano', 'guitar', 'drums', 'amp', 'music_stand', 'record', 'beanbag', 'armchair', 'sofa', 'vinyl_wall', 'poster_wave', 'neon'],
    wallpapers: ['acoustic', 'blush', 'navy'], floors: ['walnut', 'carpet_rose', 'carpet_blue'] },
  library: { items: ['bookcase', 'bookshelf', 'armchair', 'desk', 'chair_desk', 'table_coffee', 'fireplace', 'lamp_desk', 'globe', 'books',
    'mug', 'map_poster', 'certificate'],
    wallpapers: ['panel', 'navy', 'leaves'], floors: ['walnut', 'tatami', 'oak'] },
  greenhouse: { items: ['potting_bench', 'tomato', 'sunflower', 'garden_bench', 'orchid', 'watering_can', 'seedlings', 'hanging_plant', 'shelf_plants'],
    wallpapers: ['glass', 'leaves', 'stripes'], floors: ['terrazzo', 'tatami', 'oak'] },
  observatory: { items: ['telescope', 'beanbag', 'armchair', 'desk', 'chair_desk', 'bookshelf', 'globe', 'books', 'moon_lamp', 'projector',
    'star_map', 'poster_planet'],
    wallpapers: ['night', 'navy', 'acoustic'], floors: ['carpet_blue', 'walnut', 'marble'] },
};
export const allowedIn = (roomType, item) => BASICS.includes(item) || Boolean(ROOM_SHOPS[roomType]?.items.includes(item));
/** The first kind of room that sells an item (for "this belongs in a kitchen" hints). */
export const homeOf = (item) => Object.keys(ROOM_SHOPS).find((t) => ROOM_SHOPS[t].items.includes(item)) || null;

export const ITEM_CATS = [
  ['beds', 'Beds'], ['seating', 'Seating'], ['tables', 'Tables'], ['storage', 'Storage'],
  ['decor', 'Decor'], ['small', 'Small things'], ['rugs', 'Rugs'], ['wall', 'Wall'],
];

export function roomBuildCost(roomsOwned) {
  return ROOM_BUILD_COST[Math.min(roomsOwned, ROOM_BUILD_COST.length - 1)];
}
