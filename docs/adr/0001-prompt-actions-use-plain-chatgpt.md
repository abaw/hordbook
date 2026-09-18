# ADR-0001: Prompt actions use plain ChatGPT, not a custom GPT

Date: 2026-09-18. Status: accepted. Supersedes the "Custom GPT" design in spec #1 and ticket #10.

## Context

The spec planned two targets for the word card's prompt actions: plain ChatGPT (`https://chatgpt.com/?q=<full prompt>`) and, when the learner set one, a personal tutor GPT (`https://chatgpt.com/g/g-…?q=<compact prompt>`) whose instructions would shape every answer. Both were implemented in commit eeffd9b.

On the device the custom GPT link opens the right GPT in the ChatGPT iOS app, but the message box stays empty. `q` is honoured only on the plain URL; OpenAI documents no prefill mechanism for GPT links, and the earlier `?model=<gpt>&q=` workaround stopped working in 2024. The learner would have to paste the copied prompt by hand on every action.

## Decision

Prompt actions always open plain ChatGPT with a full prompt prefilled. The structure that the tutor GPT's instructions would have provided (English only, B1–B2 register, headings and bullets, per-action outline) is written into the prompt templates in `src/promptActions.ts`. The custom GPT URL setting, the compact prompt form and `docs/custom-gpt.md` are removed.

Prompts stay under 2,000 URL characters after encoding; the longest NGSL definition (270 characters) fits with room to spare, and a test guards it. The prompt is still copied to the clipboard before the link opens, as the fallback should prefill ever change.

## Consequences

- Zero-tap prompting is preserved, which the owner preferred over a consistent GPT persona plus a paste per action.
- Answers depend on the prompt alone; there is no cross-session memory or persona. Tuning the shape of answers is a one-line change to the templates.
- If OpenAI adds a supported prefill for GPT links, the compact mode can be reintroduced behind the same `PromptAction` data shape.
