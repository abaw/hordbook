# Release checklist (on-device)

The automated tests cover everything that can be observed through the DOM and the ports. These are the things they cannot reach: iOS install behaviour, storage across process death, the share sheet and Files picker, the speech voices, and the ChatGPT app hand-off. Run this on the owner's iPhone against the deployed build before tagging a release. It takes about ten minutes.

Preparation: note the build shown in **Settings › About** (for example `1.0.0 (a1b2c3d)`) and make sure it matches the commit being released.

## Checklist

### Install and launch

- [x] Open https://abaw.github.io/hordbook/ in Safari. The first-launch hint (Share → Add to Home Screen, with the pictogram) is shown.
- [x] Add to Home Screen. The icon is the book-with-tiles; the label is "Hordbook".
- [x] Launch from the home screen: full-screen, no Safari chrome; the hint is not shown.
- [x] Turn on Airplane Mode, force-quit, relaunch: the list loads, a word card opens, search works. Turn Airplane Mode off.
- [x] Settings › About shows the collection name, build date, attribution to Browne, Culligan and Phillips, the CC BY-SA 4.0 link, and the app version with commit.

### Navigation

- [x] From Home open Settings, then use the back swipe (or ‹ Home): back on the list.
- [x] Scroll deep into the list (Level 4 or later), open a word, tap ‹ Words: the list is where you left it, with any search or filter still applied.
- [x] Previous / Next on a card walk the collection by rank; Previous is absent on rank 1.

### Progress

- [x] Mark words from a row and from a card: the dot cycles unseen → learning → known → unseen and the level and collection counters update.
- [x] Force-quit and relaunch: marks and counters are unchanged, and the list opens at the last word you looked at.
- [x] Reboot the phone and relaunch: marks are still there.
- [x] The Progress filter shows only the chosen state and combines with search and part of speech.

### Backup

- [x] Settings › Backup › Export progress: the share sheet opens; Save to Files into iCloud Drive succeeds; the file name is `hordbook-progress-<today>.json`.
- [x] Reset progress… → Delete everything: the list shows every word unseen and the counters read 0.
- [x] Import… → pick the exported file: the summary shows the record count and export date; Import restores every mark and counter.

### Speak

- [x] On a card, Speak pronounces the word. Search "record" (a noun in the NGSL): Speak says "the REcord"; compare with a verb such as "abandon" ("to aBANdon").
- [x] Settings › Voice: switch to UK English, Speak again: the accent changes. Switch back if you prefer US.
- [x] Speak works in Airplane Mode.
- [x] If only the compact voice is installed, the enhanced-voice note appears after the first Speak and "Got it" hides it for good. With an Enhanced/Premium voice installed, no note appears and the voice is the enhanced one.

### ChatGPT and reference links

- [x] Each of the three prompt actions opens the ChatGPT app with the prompt already in the message box; pasting into Notes gives the same text.
- [x] Youglish and Longman open in Safari for the word; the top-left back-to-app arrow returns to Hordbook on the same card.

### Update

- [x] After a new deploy, close and reopen the installed app once while online: About shows the new commit.

## Runs

Record each release run here.

### v1.0.0

- Date: 2026-09-18
- Build (from About): 1.0.0 (38e793d)
- iPhone / iOS: owner's iPhone, iOS 26
- Result: all items ticked. Notes from the feature tickets: the custom GPT hand-off was dropped before release (ADR-0001); the enhanced-voice note names the iOS 26 menu *Read & Speak*.
