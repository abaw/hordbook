# Hordbook

![Hordbook: a personal word hoard for learning English, one collection at a time.](design/social-banner.png)

A personal, rank-ordered word hoard for learning English vocabulary, one collection at a time. The first collection is the New General Service List (NGSL 1.2): 2,809 words with easy-English definitions, Traditional Chinese glosses and IPA.

Hordbook is a static single-page web app (PWA) meant to be installed on an iPhone home screen. It has no server and no account; progress stays on the device.

## Install on iPhone

1. Open https://abaw.github.io/hordbook/ in Safari.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch it from the home screen. After the first visit it works offline, and new versions are picked up the next time you open it online.

Your progress lives only on the phone. **Settings › Backup › Export progress** saves it as a JSON file (to iCloud Drive, AirDrop, …) and **Import…** restores or merges it, so you can move to a new phone or recover after removing the app. For a natural Speak voice, download an Enhanced or Premium English voice in **Settings › Accessibility › Read & Speak › Voices › English** (called *Spoken Content* on iOS 18 and earlier); the app shows a one-time hint if only the compact voice is installed.

## ChatGPT

Each word card has three prompt actions (Example sentences, Teach me inside out, Compare with similar words). They open ChatGPT (the iOS app when installed) with a full, structured prompt already typed in, and copy the same prompt to the clipboard as a fallback. This uses your existing ChatGPT Plus subscription; no API key or custom GPT is involved (see `docs/adr/0001-prompt-actions-use-plain-chatgpt.md` for why).

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

Release: bump `version` in `package.json`, push to `main`, wait for the Pages deploy, run `docs/release-checklist.md` on the phone against the build shown in Settings › About, record the run in that file, then tag the commit (`git tag v1.0.0 && git push origin v1.0.0`).

## Data

Collection files live in `collections/` and are built by the pipeline in `data/`. Data is licensed CC BY-SA 4.0 with attribution (`collections/LICENSE-DATA.md`); code is MIT (`LICENSE`).

### Attribution

- Words, frequency ranks and easy-English definitions: the **New General Service List 1.2** by Charles Browne, Brent Culligan and Joseph Phillips, New General Service List Project, https://www.newgeneralservicelist.com — CC BY-SA 4.0.
- Pronunciations (IPA): Wiktionary contributors, via the machine-readable extracts at https://kaikki.org — CC BY-SA 4.0.
- Traditional Chinese glosses: generated for the Hordbook project from the English definitions and released under CC BY-SA 4.0.

The same notice is embedded in `collections/ngsl.json` and shown in the app under Settings › About.

### Rerun the pipeline

```sh
cd data
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pipeline.build_ngsl              # official CSV/XLSX + Wiktionary IPA → collections/ngsl.json
.venv/bin/python -m pipeline.gloss_ngsl              # glosses and parts of speech via kiro-cli (resumable, raw replies committed)
.venv/bin/python -m pipeline.build_ngsl --no-network # fold accepted glosses back in
.venv/bin/pytest && .venv/bin/mypy                   # seam-1 tests and strict typing
```

The build is deterministic: rerunning from identical inputs leaves `collections/ngsl.json` untouched. Records failing a gloss check land in `data/glosses/review-queue.json`, which must be empty before the collection is considered complete. `data/README.md` documents each step, the checks and the source quirks that shaped them.
