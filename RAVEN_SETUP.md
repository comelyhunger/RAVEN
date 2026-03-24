# RAVEN Setup Guide
### How to train RAVEN for your collecting

---

## Overview

RAVEN works because it knows what *you* love — not what a generic algorithm thinks you should love.

Before RAVEN can hunt for you, it needs to learn your taste. This guide walks you through that process. It takes about 30 minutes and you only have to do it once.

---

## Step 1: Gather Your Examples

Find **30-40 examples** of things you love in your collecting category.

These should be real objects you genuinely want or already own — not aspirational or theoretical. If you collect antique rings, find 30-40 rings you'd actually buy. If you collect vintage watches, ceramics, art glass, or anything else — same principle.

For each example you need:
- A **URL** to the listing or dealer page
- A **photo** (screenshot or saved image works fine)

**Where to find examples:**
- Your existing collection
- Dealer websites you already know and trust
- Saved searches, wish lists, past purchases
- Pinterest boards, saved Instagram posts
- Auction results for things you wish you'd bid on

---

## Step 2: Build Your Taste Profile with Claude

Open a **new Claude conversation** (not the RAVEN artifact — a fresh chat).

Paste this prompt, then share your 30-40 examples one by one or in batches:

---

**Copy this prompt:**

```
I'm building a taste profile for a collecting agent called RAVEN. 
I'm going to show you [NUMBER] examples of [WHAT YOU COLLECT] that I love. 
Please look at all of them carefully before drawing any conclusions.

As I share them, note:
- Visual patterns (materials, surfaces, colors, conditions)
- Thematic patterns (subjects, motifs, eras, origins)
- What the objects have in common that I might not have consciously noticed
- Any surprising patterns in my choices

After I've shared all the examples, I'll ask you to write a RAVEN taste profile.
```

---

Share your examples. Take your time. Let Claude ask questions.

When you've shared everything, paste this second prompt:

---

**Copy this prompt:**

```
Now that you've seen all my examples, please write a RAVEN taste profile for me. 

Format it exactly like this — I'll paste it into the RAVEN code:

COLLECTOR PROFILE section:
- Themes: [list the specific motifs/subjects I gravitate toward]
- Eras: [list the time periods]  
- Metals: [list preferred metals and purities]
- Stones: [list preferred stones, cuts, treatments]
- Signed: [list any makers/houses I favor]
- Size/Dimensions: [any size requirements]
- Budget: [my approximate ceiling]

TEXT SCORING section (format as +3/+2/+1/-1/-2 with reasons):
[list scoring rules based on what I actually love vs. what are dealbreakers]

VISUAL SCORING section:
[describe my visual aesthetic in specific, observable terms — 
what does the surface look like? how are stones set? 
what condition do I prefer? what makes something look right vs. wrong to me?]

SOURCE_BATCHES section:
[list 6-9 dealers I should start with, grouped in pairs or threes]
```

---

## Step 3: Paste Your Profile into RAVEN

Once Claude has written your taste profile, you'll have four sections:

1. **COLLECTOR PROFILE** — replaces the existing profile in `SEARCH_SYSTEM`
2. **TEXT SCORING** — replaces the scoring rules in `SEARCH_SYSTEM`  
3. **VISUAL SCORING** — replaces the aesthetic description in `VISUAL_SYSTEM`
4. **SOURCE_BATCHES** — replaces the dealer list in `SOURCE_BATCHES`

Open `raven.jsx` in a text editor and find each section. They're clearly labeled with comments. Replace each one with your custom version.

---

## Step 4: Launch RAVEN

Go to [claude.ai](https://claude.ai), start a new conversation, open the artifact panel, and paste your customized `raven.jsx`.

RAVEN launches. Run your first search.

---

## Tips for Better Results

**On choosing examples:**
The examples you choose matter more than how you describe your taste. Show RAVEN what you actually love, not what you think you should love. If you keep gravitating toward one thing you feel guilty about wanting — include it. RAVEN doesn't judge.

**On keywords:**
Specific beats broad. Every time. `Victorian snake ruby 18k` works. `Antique ring` does not. Think: stone + style + era + metal. 2-4 terms is the sweet spot.

**On dealers:**
RAVEN will find dealers you don't know. When it does, add them to your SOURCE_BATCHES for future searches. The dealer list grows with every hunt.

**On the visual scoring:**
The visual layer is the most powerful part of RAVEN — and the hardest to describe. Look at your examples and ask: what is the *surface* doing? How does the light hit it? Where is the stone sitting in relation to the metal? Describe what you see, not what you feel. "Matte, worn, naturally aged gold" is better than "I like old things."

**On building over time:**
Your first taste profile won't be perfect. After a few hunts, you'll notice patterns in what RAVEN surfaces that you love or skip. Update the scoring. Add dealers. Refine the visual language. RAVEN gets better the more you use it.

---

## Example: What a Finished Taste Profile Looks Like

Here's the profile RAVEN ships with — built from 40 antique rings examined over one evening:

```
COLLECTOR PROFILE:
- Themes: snakes/serpents (ruby eyes), intaglios (carved stone, esp. ancient Roman), 
  signet rings, mourning rings (black enamel, forget-me-not), memento mori
- Eras: Ancient Roman/Greek, Georgian, Victorian, Edwardian, Art Déco, French vintage 1950s–80s
- Metals: 18k+ yellow gold preferred; platinum ok for signed pieces
- Stones: rubies, Ceylon sapphires (untreated preferred), colored > white; 
  opaque/cabochon (A-grade jade, plasma, agate)
- Signed: Van Cleef & Arpels, Bulgari, Hermès, Schlumberger, Buccellati, 
  Gilbert Albert, Fred Paris, Mauboussin, Cartier
- Budget: ~$8,500 USD ceiling

VISUAL SCORING:
- Consistently chooses MATTE, WORN, naturally aged gold — not high-polish or over-restored
- Prefers stones FLUSH, BEZEL-SET, or RUB-OVER in the gold — not raised on prongs
- Loves an ARCHAEOLOGICAL quality — rings that look like they genuinely lived in the world
- Wants VIVID, SATURATED stone color
- Drawn to gold with CHARACTER — hammer marks, uneven patina, evidence of genuine age
```

Notice how specific this is. "Matte gold with hammer marks" is something you can see in a photograph. "Beautiful" is not. The more observable your descriptions, the better RAVEN hunts.

---

## Questions?

Open an issue on GitHub or start a conversation with Claude and share the RAVEN repo link.

🦅
