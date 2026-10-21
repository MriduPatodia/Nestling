# Nestling

A cosy home you grow by looking after yourself and getting your work done. (Rename it in `shared/settings.js`.)

- **Your character**: design a character at sign-up (long or short hair, then hair style and colour, skin tone, eyes, clothes, accessories) and pick a nickname. They walk around your rooms, sit on chairs and sofas, wave when clicked, and move between rooms. In a focus session they go to the right spot for the room (desk in the bedroom, bath mat in the bathroom, piano in the music room…) and work along with you. Edit everything, plus the app's colour theme, on the Me page.
- **AI study tutor**: personalised notes, flashcards, quizzes, hints and a Socratic chat tutor, powered by OpenRouter.
- **Upload class materials**: PDFs, Word (.docx), PowerPoint (.pptx), text files and photos of notes. The tutor writes notes, flashcards and quizzes from them, and uses them in chat. Text files, Word, PowerPoint and text-based PDFs are read on your computer. Photos and scanned PDFs are sent to the AI once, to be transcribed. Only the extracted text is stored; the original files are not kept.
- **Dream home**: an isometric house you expand room by room. Each room type (bedroom, study, living room, kitchen, bathroom, music room, library, greenhouse, observatory) has its own shop of themed furniture and decor, plus basics like windows, plants and rugs that go anywhere. Wallpapers and floors that suit the room are shown first. Small things can sit on desks and tables. Rooms follow your real clock (day, dusk, night lighting, a working wall clock).
- **Progressive independence**: work you do yourself pays full coins and earns independence XP. AI-assisted work pays less as you level up (100% → 75% → 50% → 25% → 10%). The best rooms and furniture unlock at higher independence levels.
- **Focus timer**: a customisable Pomodoro timer, timed on the server so coins can't be faked. It keeps running while you decorate.
- **Daily goals & streaks**: finish your goals to open a chest. Each streak day adds ×0.1 to all coins earned (up to ×2). Streak freezes cover missed days.
- **Daily check-in & journal**: a 30-second check-in (mood, stress, sleep, how your body feels, what's on your mind) with suggestions based on the answers, box breathing and 5-4-3-2-1 grounding exercises, a journal with prompts, a "worry dump" that deletes what you write, and a 14-day mood/stress/sleep chart. Private to each account and never sent to the AI. If a journal entry mentions self-harm or suicide, helpline numbers are shown.
- **Talk to someone**: links to IMH's anonymous chat plus Singapore helplines. It works without logging in, and nothing on it is tracked.

## Run it

Requires **Node.js 22.13 or newer** (it uses the built-in `node:sqlite`). There are no npm dependencies, so there's nothing to install.

```bash
cp .env.example .env      # then put your OpenRouter key in .env
npm start                 # http://localhost:3000
```

Use `npm run dev` to restart automatically on file changes, and `npm test` to run the test suite.

### .env

| Variable | What it does |
| --- | --- |
| `OPENROUTER_API_KEY` | Your key from https://openrouter.ai/keys. Without it the app still works, but AI features are switched off. |
| `OPENROUTER_MODEL` | Model id used for notes, cards, quizzes and chat. Defaults to `openrouter/auto`. Pick any id listed at https://openrouter.ai/models. |
| `OPENROUTER_MODEL_FAST` | Optional cheaper model for quiz hints. |
| `OPENROUTER_MODEL_VISION` | Optional model for reading photos and scanned PDFs. It must accept image/PDF input. Defaults to `OPENROUTER_MODEL`. |
| `PORT` | Defaults to 3000. |
| `APP_URL` | Your public URL, sent to OpenRouter as the `HTTP-Referer` attribution header. |
| `COOKIE_SECURE` | Set to `true` when serving over HTTPS. |
| `DATABASE_PATH` | SQLite file. Defaults to `./data/studystead.db`. |
| `AI_HOURLY_LIMIT` | Max AI requests per student per hour (default 60). |

## How it's built

```
shared/      catalog.js (furniture, rooms, prices, coin rules) + placement.js (placement rules)
             used by BOTH server and browser, so prices and rules can't drift
server/      plain node:http server, SQLite, scrypt passwords, HttpOnly session cookies
  economy.js every coin, streak, goal and independence rule (server is the authority)
  ai.js      OpenRouter client (streaming + JSON + photo/scan transcription), prompts
  extract/   dependency-free readers for PDF, .docx, .pptx and text files
  routes/    auth, profile, study, ai, focus, home
public/      vanilla ES modules, no build step
  js/iso/    canvas isometric renderer, furniture art, wallpaper/floor patterns
  js/views/  house, room editor, study, focus, progress, talk, auth
test/        node:test API tests against a fake OpenRouter server
```

**Anti-cheat basics:** quiz answers are checked on the server, hints are recorded server-side, focus minutes come from server timestamps, rewards have daily caps, and repeat answers within a short window pay nothing.

**Privacy:** every query is scoped to the logged-in user. No email is collected. Students can delete their account, which removes all their data. The OpenRouter key stays on the server.

## Deploying

This is one Node process with a SQLite file. Any host that runs Node 22.13+ and has a persistent disk will work (a VPS, Fly.io or Render with a volume, Railway with a volume, and so on). Serve it over HTTPS, then set `COOKIE_SECURE=true` and `APP_URL`.
