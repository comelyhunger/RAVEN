# RAVEN
A Claude-powered collecting agent that learns your taste and hunts for you
# RAVEN 🦅
### A Claude-powered collecting agent that learns your taste and hunts for you

---

## Welcome to RAVEN

RAVEN is a Claude add-on that finds beautiful things you didn't know you were looking for.

Unlike a search engine — which matches your keywords to words on a page — RAVEN learns what you actually want from examples you show it, then hunts across the web scoring every find against your specific taste profile.

---

## How It Works

### Step 1: Build your taste profile
Give RAVEN 40 great examples of what you're looking for. For rings, that means 40 rings with URLs and images. For anything else — bracelets, watches, ceramics, vintage clothing — same principle. Show it what you love.

### Step 2: Let RAVEN analyze your selection
Ask RAVEN to look for patterns you haven't explicitly recognized. You might think you love rubies — RAVEN might notice you actually love opaque stones, flush-set, in matte gold. The patterns in your choices are often more specific than your words for them.

### Step 3: Let RAVEN fly
With your taste profile loaded, run a search. Use specific keywords — 2-4 terms works best. RAVEN will search across multiple dealers, fetch individual product pages, score every find against your profile (text score + visual score), and return ranked results.

### Step 4: Queue your finds
Hit **+** on any card to add it to your New Finds queue. When you're done, copy the CSV and paste it into your spreadsheet.

---

## The Methodology

The context-building step is not optional — it's the whole thing.

A generic search prompt returns generic results. A taste profile built from 40 real examples that you actually chose returns results that feel like someone who knows you went looking on your behalf.

This is the difference between a search engine and a collector's agent.

---

## Customizing RAVEN for Your Collecting

RAVEN ships configured for antique jewelry (rings, specifically). To adapt it for your own collecting:

**Change the COLLECTOR PROFILE** in the `SEARCH_SYSTEM` prompt:
- What you collect (rings → bracelets, watches, ceramics, etc.)
- Your preferred eras, materials, makers
- Your budget
- Your size or dimension requirements
- Any signed makers or houses you favor

**Change the TEXT SCORING** to weight what matters to you:
- +3 for your highest-priority themes
- +2 for strong preferences
- +1 for nice-to-haves
- -1/-2 for dealbreakers

**Change the VISUAL SCORING** in `VISUAL_SYSTEM`:
- Describe your aesthetic in specific visual terms
- What does good look like vs. bad?
- What does the surface/condition/setting style tell you?

**Change the SOURCE_BATCHES** to your dealers:
- Add specialist dealers in your category
- Remove irrelevant ones
- Group them into batches of 2-3 for best results

---

## Keywords That Work

Specific beats broad. Every time.

✓ `Victorian snake ruby 18k`
✓ `Georgian mourning enamel black`
✓ `carnelian intaglio antique gold`
✓ `lapis lazuli signet Edwardian`

✗ `antique ring`
✗ `sapphire` (single word)
✗ `gold jewelry vintage`

---

## Technical Notes

- Built as a single JSX artifact — paste directly into Claude.ai, no setup required
- Requires a Claude account (claude.ai)
- Uses Claude's web search tool — searches happen in real time
- Gold spot price is editable in the header — update it for accurate melt values
- Visual evaluation is on-demand — click 👁 Evaluate on individual cards, or Evaluate All

---

## About RAVEN

RAVEN was built in one evening by a collector who was tired of missing things.

The name felt right. Ravens are intelligent, they recognize patterns, they remember, and they find shiny things.

🦅

---

*RAVEN is not affiliated with any dealer or marketplace. It searches the public web.*
