# Collection data licence

The collection files in this directory are derivative works released under the
Creative Commons Attribution-ShareAlike 4.0 International licence
(CC BY-SA 4.0): https://creativecommons.org/licenses/by-sa/4.0/

This licence applies to the data files only. The Hordbook application code is
licensed separately (see the repository's `LICENSE`).

## ngsl.json

- Word list, frequency ranks and easy-English definitions: the New General
  Service List 1.2 by Charles Browne, Brent Culligan and Joseph Phillips,
  New General Service List Project, https://www.newgeneralservicelist.com —
  licensed under CC BY-SA 4.0. Source files:
  `NGSL_12_stats.csv` and `NGSL_12_with_English_definitions.xlsx`.
  Recommended citation: Browne, C., Culligan, B. & Phillips, J. (2013). The
  New General Service List. Retrieved from https://www.newgeneralservicelist.com
- Pronunciations (IPA): Wiktionary contributors, obtained through the
  machine-readable extracts at https://kaikki.org — licensed under CC BY-SA 4.0.
- Traditional Chinese glosses: generated for the Hordbook project from the
  English definitions above and released under CC BY-SA 4.0.

Changes made: the two official files were joined on lemma, spellings were
normalised (`TRUE`/`FALSE` → `true`/`false`; `e-mail` → `email`), the 52
unranked supplementary words were omitted, and pronunciations and glosses were
added. The 2,809 ranked words, their ranks and their definitions are otherwise
unchanged.
