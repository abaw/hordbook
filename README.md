# Hordbook

![Hordbook: a personal word hoard for learning English, one collection at a time.](design/social-banner.png)

A personal, rank-ordered word hoard for learning English vocabulary, one collection at a time. The first collection is the New General Service List (NGSL 1.2): 2,809 words with easy-English definitions, Traditional Chinese glosses and IPA.

Hordbook is a static single-page web app (PWA) meant to be installed on an iPhone home screen. It has no server and no account; progress stays on the device.

## Install on iPhone

1. Open the app URL in Safari (published by GitHub Pages under `/hordbook/`).
2. Tap **Share**, then **Add to Home Screen**.
3. Launch it from the home screen. After the first visit it works offline.

## ChatGPT

Each word card has three prompt actions (Example sentences, Teach me inside out, Compare with similar words). They copy a prompt to the clipboard and open ChatGPT with it prefilled, using your existing ChatGPT Plus subscription; no API key is involved. For consistent, well-structured answers, create a personal tutor GPT once: **Settings → ChatGPT** in the app walks you through it and copies the GPT instructions (kept in `docs/custom-gpt.md`) to your clipboard; then paste the GPT's link into **Custom GPT URL**.

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # seam-2 tests (Vitest + Testing Library, jsdom)
npm run typecheck  # strict TypeScript
npm run build      # typecheck + production build with manifest and service worker
npm run preview    # serve dist/ locally under /hordbook/
```

The app is Preact + TypeScript + Vite. `src/App.tsx` is the single root; it receives its dependencies as ports (`src/ports.ts`): the collection, a progress store, a platform object and the app version. Screens live in `src/screens/` and are addressed by URL fragment (`#/settings`) so the browser back button works in the installed app. Production wiring lives in `src/main.tsx` and `src/browser.ts`; tests wire in-memory fakes from `src/test/fakes.ts` through `src/test/renderApp.tsx`.

Deployment: pushing to `main` runs `.github/workflows/pages.yml`, which tests, builds and publishes `dist/` to GitHub Pages.

Images: the masters live in `design/`; `python3 design/derive.py` (needs Pillow) regenerates the icons in `public/`, the illustrations in `src/assets/` and the social banner.

## Data

Collection files live in `collections/` and are built by the pipeline in `data/` (see `data/README.md`). Data is licensed CC BY-SA 4.0 with attribution (`collections/LICENSE-DATA.md`); code is MIT (`LICENSE`).
