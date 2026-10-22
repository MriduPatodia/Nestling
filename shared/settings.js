// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to rename the app or change how many coins things earn.
//  Save, then restart the server (Ctrl+C, then `npm start`) and refresh the page.
// ─────────────────────────────────────────────────────────────

// The name shown in the app (sidebar, login page, browser tab, messages).
export const APP_NAME = 'Nestling';

// Pause a focus session automatically when you leave the Focus page, switch browser tabs or close the app.
// Set to false to let the timer keep running in the background.
export const AUTO_PAUSE_FOCUS = true;

// Coins earned for each action (before the streak multiplier).
// Work she does herself ("independent") pays more than work the AI does for her.
export const COINS = {
  // Independent work: no AI
  own_notes_per_8_words: 2,   // writing her own notes, for every 8 new words
  own_flashcard: 6,           // making her own flashcard
  own_quiz_question: 8,       // writing her own quiz question
  recall_card: 4,             // typing the answer before flipping a card, and getting it right
  quiz_correct: 6,            // answering a quiz question right without a hint

  // AI-assisted work
  ai_notes: 2,                // asking the AI to write notes
  ai_flashcards: 2,           // asking the AI to make a deck of flashcards
  ai_quiz: 2,                 // asking the AI to write a quiz
  quiz_correct_with_hint: 1,  // answering right after getting an AI hint

  // Everything else
  flip_card: 1,               // reviewing a card by just flipping it
  focus_minute: 1,            // each minute of a focus session
  focus_session_done: 5,      // bonus for finishing a focus session
  daily_chest: 25,            // bonus for finishing all daily goals

  // Wellbeing (pays once a day each)
  daily_checkin: 3,           // doing the daily check-in
  journal_entry: 3,           // writing a journal entry
};
