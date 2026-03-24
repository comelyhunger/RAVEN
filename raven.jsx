import { useState, useRef } from "react";

const GOLD_DEFAULT = 4446.00;

const LOADING_MSGS = [
  "Consulting the dealers of Nieuwe Spiegelstraat…",
  "Weighing melt values in troy ounces…",
  "Hunting serpents, signets, and plasma intaglios…",
  "Fetching product pages for image URLs…",
  "Scoring against your taste profile…",
  "Searching mourning rings and matte gold…",
];

const callClaude = async (system, userContent, useSearch = false, tokens = 16000) => {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: tokens,
    system,
    messages: [{ role: "user", content: userContent }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try { const err = await res.json(); detail = err?.error?.message || JSON.stringify(err); } catch {}
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json();
};

const extractJSON = (text) => {
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : null;
  if (!parsed) throw new Error("No JSON found in response — try narrower keywords");
  return parsed;
};

const withTimeout = (promise, ms = 120000) =>
  Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Timed out after ${ms / 1000}s`)), ms)),
  ]);

const SEARCH_SYSTEM = (goldSpot, sources) => `You are a specialist antique jewelry research assistant for Kathleen (ring size 5.75, budget ~$8,500 USD).

COLLECTOR PROFILE:
- Themes: snakes/serpents (ruby eyes), intaglios (carved stone, esp. ancient Roman), signet rings, mourning rings (black enamel, forget-me-not), memento mori
- Eras: Ancient Roman/Greek, Georgian, Victorian, Edwardian, Art Déco, French vintage 1950s–80s
- Metals: 18k+ yellow gold preferred; platinum ok for signed pieces
- Stones: rubies, Ceylon sapphires (untreated preferred), colored > white; opaque/cabochon (A-grade jade, plasma, agate)
- Signed: Van Cleef & Arpels, Bulgari, Hermès, Schlumberger, Buccellati, Gilbert Albert, Fred Paris, Mauboussin, Cartier
- Size: 5.75 ideal; 5–7 acceptable; note resizability; flag if outside range
- Budget: ~$8,500 USD ceiling
- Gold spot: $\${goldSpot}/troy oz — melt = weight_g × purity ÷ 31.1035 × \${goldSpot}

TEXT SCORING:
+3: intaglio carved stone | +3: serpent/snake | +3: mourning/black enamel
+2: signet format | +2: signed house | +2: non-heat-treated stone stated | +2: museum provenance
+1: French origin | +1: Victorian/Georgian | +1: ruby or Ceylon sapphire | +1: size 5–6.5
-1: gap > 2 sizes | -2: cannot be resized | -2: price > $8,500

SOURCES FOR THIS BATCH: \${sources}

INSTRUCTIONS:
1. Use web_search to find relevant ring listings on the specified sources
2. Use web_fetch on the 5–8 most promising individual product page URLs you find
3. Extract from each product page: price, metal, stones, weight, era, size, resizability, status, and image URLs (look for og:image, product photo src, CDN URLs)
4. Do NOT stop mid-task. Do NOT report progress. Skip any URL that fails and continue.
5. Return ONLY the raw JSON when all fetches are complete.

Return ONLY raw valid JSON — no markdown, no preamble:
{"rings":[{"id":"r1","dealer":"","name":"","price_usd":0,"price_display":"","metal":"","stones":"","weight_g":null,"melt_usd":null,"era":"","listed_size":"","size_gap":"","resizable":"","url":"","image_urls":[],"text_score":0,"score_reasons":[],"notes":"","status":"available"}],"search_summary":""}`;

const SOURCE_BATCHES = [
  "antiquejewellerycompany.com and butterlaneantiques.com",
  "ravensburyantiques.com and inezstodel.com and curiouslytimeless.com",
  "1stdibs.com and ebay.com",
];

const VISUAL_SYSTEM = `You evaluate antique/vintage jewelry photos for Kathleen — a sophisticated collector whose visual aesthetic has been carefully established from examining 35+ rings she has chosen.

KATHLEEN'S VISUAL PREFERENCES:
- Consistently chooses MATTE, WORN, naturally aged gold — not high-polish or over-restored
- Prefers stones FLUSH, BEZEL-SET, or RUB-OVER in the gold — not raised on prongs
- Loves an ARCHAEOLOGICAL quality — rings that look like they genuinely lived in the world for centuries
- Wants VIVID, SATURATED stone color: ruby = hot pink-red or deep red; sapphire = rich blue; jade = vivid green
- Two collecting modes she gravitates toward: "archaeological" (matte, ancient, flush-set) and "French luxury" (polished, technical, signed)
- Drawn to gold with CHARACTER — hammer marks, uneven patina, evidence of genuine age

VISUAL SCORING:
+1: Gold surface reads matte, worn, naturally aged (not high-polish)
+1: Stones sit flush/bezel/rub-over — INTO the gold, not raised on prongs
+1: Ring has genuine archaeological or "lived in the world" quality
+1: Stone color is vivid and well-saturated
-1: Visibly over-polished or over-restored — lost its authentic patina
-1: Stone noticeably duller or weaker in color than the listing implies
-1: Condition appears worse than described (chips, cracks, heavy damage visible)

Return ONLY raw valid JSON with no markdown fences:
{
  "visual_score": 0,
  "visual_summary": "2–3 sentence visual assessment mentioning what you see",
  "gold_surface": "matte|polished|mixed",
  "setting_style": "flush/bezel/rub-over|prong|mixed",
  "archaeological": "high|medium|low",
  "stone_color": "vivid|medium|pale|na",
  "condition_flags": [],
  "standout_detail": "one specific visual observation NOT mentioned in the listing text"
}`;

export default function RingFinder() {
  const [goldSpot, setGoldSpot] = useState(GOLD_DEFAULT);
  const [keywords, setKeywords] = useState("");
  const [phase, setPhase] = useState("idle");
  const [msgIdx, setMsgIdx] = useState(0);
  const [rings, setRings] = useState([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [queued, setQueued] = useState([]);
  const [activeTab, setActiveTab] = useState("search");
  const [evaluating, setEvaluating] = useState({});
  const intervalRef = useRef(null);

  const startTicker = () => {
    let i = 0;
    intervalRef.current = setInterval(() => { i = (i + 1) % LOADING_MSGS.length; setMsgIdx(i); }, 2600);
  };
  const stopTicker = () => clearInterval(intervalRef.current);

  const runSearch = async () => {
    setPhase("searching");
    setError("");
    setRings([]);
    setSummary("");
    startTicker();

    const kw = keywords.trim() || "Victorian snake ring ruby intaglio mourning gold";
    const userMsg = `Search for antique rings matching Kathleen's profile, focus on: ${kw}. Use web_search then web_fetch on individual product pages. Do NOT stop or report progress. Return ONLY the raw JSON object — nothing else.`;

    try {
      const data = await withTimeout(
        callClaude(SEARCH_SYSTEM(goldSpot, "antiquejewellerycompany.com, butterlaneantiques.com, ravensburyantiques.com, inezstodel.com, 1stdibs.com, ebay.com"), userMsg, true, 16000),
        150000
      );
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const parsed = extractJSON(text);
      if (!parsed || !parsed.rings?.length) {
        setError("No rings found — try a more specific keyword like 'Victorian snake ruby 18k'");
      } else {
        const sorted = parsed.rings.sort((a, b) => b.text_score - a.text_score);
        setRings(sorted.map(r => ({ ...r, visual: null })));
        setSummary(parsed.search_summary || "");
      }
    } catch (e) {
      setError(`Search failed: ${e.message}`);
    } finally {
      stopTicker();
      setPhase("done");
    }
  };;

  const evaluateRing = async (ring) => {
    const imgs = (ring.image_urls || []).filter(u => u?.startsWith("http")).slice(0, 3);
    if (!imgs.length) return;

    setEvaluating(p => ({ ...p, [ring.id]: true }));
    try {
      // Try with images first, fall back to text-only if 400
      const imageBlocks = imgs.map(url => ({ type: "image", source: { type: "url", url } }));
      const textBlock = {
        type: "text",
        text: `Ring: "${ring.name}" from ${ring.dealer}
Metal: ${ring.metal || "not specified"} | Stones: ${ring.stones || "not specified"} | Era: ${ring.era || "not specified"}
Text score: ${ring.text_score}/10 — reasons: ${(ring.score_reasons || []).join(", ")}
Image URLs for reference: ${imgs.join(", ")}

Evaluate this ring against Kathleen's visual profile based on the images and listing details. Return ONLY the raw JSON.`
      };

      let data;
      try {
        data = await withTimeout(callClaude(VISUAL_SYSTEM, [...imageBlocks, textBlock], false, 1000), 45000);
      } catch (imgErr) {
        // Fall back to text-only evaluation if image loading fails
        data = await withTimeout(callClaude(VISUAL_SYSTEM, textBlock.text, false, 1000), 30000);
      }
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const vis = extractJSON(text);
      setRings(prev => prev.map(r => r.id === ring.id
        ? { ...r, visual: vis, total_score: r.text_score + (vis.visual_score || 0) }
        : r
      ));
    } catch (e) {
      setRings(prev => prev.map(r => r.id === ring.id
        ? { ...r, visual: { error: e.message } }
        : r
      ));
    } finally {
      setEvaluating(p => { const n = { ...p }; delete n[ring.id]; return n; });
    }
  };

  const evalAll = async () => {
    const todo = rings.filter(r => !r.visual && !evaluating[r.id] && (r.image_urls || []).filter(u => u?.startsWith("http")).length > 0);
    for (const ring of todo) await evaluateRing(ring);
  };

  const queueRing = (r) => { if (!queued.find(q => q.id === r.id)) setQueued(p => [...p, r]); };
  const dequeue = (id) => setQueued(p => p.filter(r => r.id !== id));

  const totalScore = (r) => r.total_score ?? r.text_score;
  const scoreColor = (s) => s >= 10 ? "#C8A96E" : s >= 7 ? "#9CAF88" : s >= 5 ? "#7A9BB5" : "#7A7060";
  const scoreLabel = (s) => s >= 10 ? "✦ Exceptional" : s >= 7 ? "★ Strong" : s >= 5 ? "◆ Good" : "◇ Possible";

  const csvEscape = (v) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const CSV_HEADERS = ["Dealer","Name","Price","Metal","Stones","Era","Listed Size","Size Gap","Resizable","Melt Value","Text Score","Visual Score","Total Score","Notes","URL"];

  const exportCSV = [
    CSV_HEADERS.join(","),
    ...queued.map(r => [
      r.dealer, r.name,
      r.price_display || (r.price_usd ? `$${r.price_usd}` : ""),
      r.metal, r.stones, r.era,
      r.listed_size, r.size_gap, r.resizable,
      r.melt_usd ? `~$${Math.round(r.melt_usd)}` : "",
      r.text_score, r.visual?.visual_score ?? "", totalScore(r),
      r.notes, r.url,
    ].map(csvEscape).join(","))
  ].join("\n");

  const [copied, setCopied] = useState(false);
  const downloadCSV = () => {
    navigator.clipboard.writeText(exportCSV).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const exportText = exportCSV;

  const hasImages = (r) => (r.image_urls || []).filter(u => u?.startsWith("http")).length > 0;
  const pendingVisual = rings.filter(r => !r.visual && !evaluating[r.id] && hasImages(r)).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0C09", color: "#E8DFC8", fontFamily: "Georgia,'Times New Roman',serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0D0C09}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#C8A96E22;border-radius:2px}
        .pf{font-family:'Playfair Display',Georgia,serif}
        .cg{font-family:'Cormorant Garamond',Georgia,serif}
        .card{background:#17150F;border:1px solid #C8A96E14;padding:16px 18px;margin-bottom:8px;transition:border-color .2s}
        .card:hover{border-color:#C8A96E30}
        .card-hi{border-color:#C8A96E28!important;background:#1A1810}
        .btn-gold{background:#C8A96E;color:#0D0C09;border:none;padding:10px 24px;cursor:pointer;font-family:'Playfair Display',serif;font-size:13px;letter-spacing:.1em;text-transform:uppercase;transition:background .15s;white-space:nowrap}
        .btn-gold:hover{background:#D4B97E}
        .btn-gold:disabled{background:#3A3020;color:#6A5840;cursor:not-allowed}
        .btn-eye{background:#1A2418;border:1px solid #9CAF8825;color:#9CAF8877;padding:5px 11px;cursor:pointer;font-family:'Cormorant Garamond',serif;font-size:13px;transition:all .15s}
        .btn-eye:hover{color:#9CAF88;border-color:#9CAF8845;background:#1E2A1C}
        .btn-eye:disabled{opacity:.35;cursor:default}
        .btn-sm{background:transparent;border:1px solid #C8A96E22;color:#C8A96E66;padding:5px 10px;cursor:pointer;font-family:'Cormorant Garamond',serif;font-size:12px;transition:all .15s}
        .btn-sm:hover{color:#C8A96E;border-color:#C8A96E44}
        .btn-sm:disabled{opacity:.3;cursor:default}
        .input{background:#17150F;border:1px solid #C8A96E18;color:#E8DFC8;padding:8px 11px;font-family:'Cormorant Garamond',serif;font-size:15px;outline:none;transition:border-color .2s;width:100%}
        .input:focus{border-color:#C8A96E44}
        .input::placeholder{color:#3A3020}
        .tab{padding:8px 16px;cursor:pointer;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#4A4030;border-bottom:1px solid transparent;transition:all .2s}
        .tab.on{color:#C8A96E;border-bottom-color:#C8A96E}
        .tab:hover{color:#C8A96E77}
        .lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#3A3020;margin-bottom:2px}
        .val{font-size:12px;color:#9A8860}
        .tag{font-size:10px;padding:2px 6px;background:#C8A96E08;border:1px solid #C8A96E15;color:#C8A96E55;letter-spacing:.03em}
        .vtag{font-size:10px;padding:2px 6px;background:#9CAF8808;border:1px solid #9CAF8820;color:#9CAF8866}
        .wtag{font-size:10px;padding:2px 6px;background:#CC777708;border:1px solid #CC777720;color:#CC777766}
        .divider{border:none;border-top:1px solid #C8A96E0C}
        a{color:#C8A96E44;text-decoration:none;transition:color .15s}a:hover{color:#C8A96E}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeUp .25s ease-out forwards}
        @keyframes breathe{0%,100%{opacity:.7}50%{opacity:.15}}.pulse{animation:breathe 1.8s ease-in-out infinite}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}.shimmer{animation:shimmer 1.4s ease-in-out infinite}
        .rimg{width:60px;height:60px;object-fit:cover;border:1px solid #C8A96E10;flex-shrink:0;background:#141210}
        .rimg-ph{width:60px;height:60px;background:#141210;border:1px solid #C8A96E08;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#2A2418;font-size:20px}
        .vis-panel{background:#111A10;border:1px solid #9CAF8815;padding:10px 12px;margin-top:10px;border-radius:1px}
        .vis-load{background:#111A10;border:1px solid #9CAF8808;padding:9px 12px;margin-top:10px}
        .chip{font-size:11px;padding:3px 9px;letter-spacing:.05em}
        .chip-txt{font-size:10px;padding:2px 7px;letter-spacing:.04em}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #C8A96E10", background: "linear-gradient(180deg,#161310 0%,#0D0C09 100%)", padding: "22px 34px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <span style={{ color: "#C8A96E2A", fontSize: 11 }}>✦</span>
              <h1 className="pf" style={{ fontSize: 21, fontWeight: 400, letterSpacing: ".05em", color: "#EAE0C8" }}>Ring Finder</h1>
              <span style={{ color: "#C8A96E2A", fontSize: 11 }}>✦</span>
              <span style={{ fontSize: 9, color: "#3A3020", letterSpacing: ".14em", textTransform: "uppercase" }}>v3</span>
            </div>
            <p style={{ fontSize: 10, color: "#4A4030", letterSpacing: ".1em", textTransform: "uppercase" }}>
              Kathleen · 5.75 · Snake · Signet · Intaglio · Mourning · Matte Gold
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, color: "#3A3020" }}>Gold</span>
            <input className="input" type="number" value={goldSpot}
              onChange={e => setGoldSpot(parseFloat(e.target.value) || GOLD_DEFAULT)}
              style={{ width: 78, padding: "5px 8px", fontSize: 13 }} />
            <span style={{ fontSize: 10, color: "#3A3020" }}>/oz</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #C8A96E0C", padding: "0 34px", display: "flex" }}>
        <div className={`tab ${activeTab === "search" ? "on" : ""}`} onClick={() => setActiveTab("search")}>Search</div>
        <div className={`tab ${activeTab === "queue" ? "on" : ""}`} onClick={() => setActiveTab("queue")}>
          New Finds {queued.length > 0 && <span style={{ color: "#C8A96E", marginLeft: 3 }}>({queued.length})</span>}
        </div>
      </div>

      <div style={{ padding: "22px 34px", maxWidth: 860 }}>

        {/* ── SEARCH TAB ── */}
        {activeTab === "search" && (<>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="lbl" style={{ marginBottom: 5 }}>Keywords (optional)</div>
              <input className="input"
                placeholder="e.g. Georgian intaglio, Victorian snake ruby, French mourning…"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                onKeyDown={e => e.key === "Enter" && phase !== "searching" && runSearch()} />
            </div>
            <button className="btn-gold" onClick={runSearch} disabled={phase === "searching"}>
              {phase === "searching" ? "Searching…" : "Run Search"}
            </button>
            {rings.length > 0 && pendingVisual > 0 && (
              <button className="btn-eye" onClick={evalAll}
                disabled={Object.keys(evaluating).length > 0}>
                {Object.keys(evaluating).length > 0
                  ? `Examining ${Object.keys(evaluating).length}…`
                  : `👁 Evaluate All Images (${pendingVisual})`}
              </button>
            )}
          </div>

          <hr className="divider" style={{ marginBottom: 18 }} />

          {/* Loading */}
          {phase === "searching" && (
            <div style={{ textAlign: "center", padding: "56px 0" }}>
              <div className="pulse pf" style={{ fontSize: 28, color: "#C8A96E18", letterSpacing: ".3em", marginBottom: 16 }}>✦ ◆ ✦</div>
              <p className="cg" style={{ color: "#6A6050", fontSize: 16, fontStyle: "italic" }}>{LOADING_MSGS[msgIdx]}</p>
              <p style={{ color: "#2A2618", fontSize: 11, marginTop: 10, letterSpacing: ".05em" }}>
                Fetching product pages for image URLs — this takes 2–4 minutes
              </p>
            </div>
          )}

          {/* Error */}
          {error && phase !== "searching" && (
            <div style={{ background: "#180808", border: "1px solid #7B000020", padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#CC8888" }}>
              {error}
            </div>
          )}

          {/* Summary + eval-all hint */}
          {summary && (
            <div style={{ marginBottom: 14 }}>
              <p className="cg" style={{ fontSize: 13, color: "#6A6050", fontStyle: "italic", marginBottom: 6 }}>{summary}</p>
              {pendingVisual > 0 && (
                <p style={{ fontSize: 11, color: "#4A5A40", letterSpacing: ".04em" }}>
                  ↑ {pendingVisual} rings have images — hit <em style={{ color: "#9CAF8866" }}>Evaluate All Images</em> above, or click <em style={{ color: "#9CAF8866" }}>👁 Evaluate</em> on individual cards
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {rings.length > 0 && phase !== "searching" && (
            <div>
              <p style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#4A4030", marginBottom: 11 }}>
                {rings.length} rings · sorted by score
              </p>

              {[...rings].sort((a, b) => totalScore(b) - totalScore(a)).map((ring, i) => {
                const ts = totalScore(ring);
                const imgs = (ring.image_urls || []).filter(u => u?.startsWith("http")).slice(0, 3);
                const isEval = evaluating[ring.id];
                const hasVis = ring.visual && !ring.visual.error;

                return (
                  <div key={ring.id || i} className={`card fade ${ts >= 8 ? "card-hi" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 12) * .03}s` }}>

                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* Images */}
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {imgs.length > 0
                          ? imgs.map((url, j) => (
                            <img key={j} src={url} alt="" className="rimg"
                              onError={e => { e.target.style.display = "none"; }} />
                          ))
                          : <div className="rimg-ph">◈</div>
                        }
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Score row */}
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 7, alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="chip" style={{ background: `${scoreColor(ts)}10`, border: `1px solid ${scoreColor(ts)}28`, color: scoreColor(ts) }}>
                              {scoreLabel(ts)} · {ts}
                            </span>
                            <span className="chip-txt" style={{ background: "#1A1810", border: "1px solid #C8A96E12", color: "#6A6040" }}>
                              text {ring.text_score}
                            </span>
                            {hasVis && (
                              <span className="chip-txt" style={{ background: "#111A10", border: "1px solid #9CAF8818", color: "#6A9A6A" }}>
                                visual {ring.visual.visual_score >= 0 ? "+" : ""}{ring.visual.visual_score}
                              </span>
                            )}
                            {ring.status === "sold" && (
                              <span className="chip-txt" style={{ background: "#180808", border: "1px solid #7B000018", color: "#AA6666" }}>Sold</span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                            {imgs.length > 0 && !hasVis && (
                              <button className="btn-eye" onClick={() => evaluateRing(ring)} disabled={isEval}>
                                {isEval ? <span className="shimmer">examining…</span> : "👁 Evaluate"}
                              </button>
                            )}
                            {ring.url && <a href={ring.url} target="_blank" rel="noopener noreferrer" className="btn-sm">View →</a>}
                            <button className="btn-sm" onClick={() => queueRing(ring)} disabled={queued.some(q => q.id === ring.id)}>
                              {queued.some(q => q.id === ring.id) ? "✓" : "+"}
                            </button>
                          </div>
                        </div>

                        <h3 className="pf" style={{ fontSize: 15, fontWeight: 400, color: "#EAE0C8", lineHeight: 1.3, marginBottom: 2 }}>
                          {ring.name}
                        </h3>
                        <div style={{ fontSize: 10, color: "#4A4030", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 9 }}>
                          {ring.dealer}
                        </div>

                        {/* Specs */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: "5px 12px", marginBottom: 8 }}>
                          {[
                            ["Price", ring.price_display || (ring.price_usd ? `$${Number(ring.price_usd).toLocaleString()}` : "—")],
                            ["Melt", ring.melt_usd ? `~$${Math.round(ring.melt_usd).toLocaleString()}` : "—"],
                            ["Era", ring.era || "—"],
                            ["Size", ring.listed_size || "—"],
                            ["Gap", ring.size_gap || "—"],
                            ["Resize", ring.resizable || "—"],
                          ].map(([l, v]) => (
                            <div key={l}><div className="lbl">{l}</div><div className="val">{v}</div></div>
                          ))}
                        </div>

                        {ring.metal && <div style={{ fontSize: 11, color: "#6A5A38", marginBottom: 3 }}>{ring.metal}</div>}
                        {ring.stones && <div className="cg" style={{ fontSize: 13, color: "#9A8860", fontStyle: "italic", marginBottom: 7 }}>{ring.stones}</div>}

                        {(ring.score_reasons || []).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: ring.notes ? 7 : 0 }}>
                            {ring.score_reasons.map((r, j) => <span key={j} className="tag">{r}</span>)}
                          </div>
                        )}

                        {ring.notes && (
                          <div className="cg" style={{ fontSize: 12, color: "#5A5238", lineHeight: 1.55, borderTop: "1px solid #C8A96E08", paddingTop: 7 }}>
                            {ring.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Visual loading */}
                    {isEval && (
                      <div className="vis-load">
                        <span className="shimmer" style={{ fontSize: 10, color: "#4A5A40", letterSpacing: ".1em", textTransform: "uppercase" }}>
                          examining images against your aesthetic…
                        </span>
                      </div>
                    )}

                    {/* Visual panel */}
                    {hasVis && (
                      <div className="vis-panel">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 7 }}>
                          <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "#3A5A38" }}>Visual Eye</span>
                          <span style={{ fontSize: 13, color: ring.visual.visual_score >= 2 ? "#9CAF88" : ring.visual.visual_score >= 0 ? "#C8A96E" : "#CC8888" }}>
                            {ring.visual.visual_score >= 0 ? "+" : ""}{ring.visual.visual_score}
                          </span>
                          {[
                            ring.visual.gold_surface === "matte" ? "◉ matte gold" : ring.visual.gold_surface === "polished" ? "○ polished" : "◎ mixed",
                            ring.visual.setting_style?.includes("bezel") || ring.visual.setting_style?.includes("flush") || ring.visual.setting_style?.includes("rub") ? "⬤ flush set" : ring.visual.setting_style?.includes("prong") ? "✦ prong set" : null,
                            ring.visual.archaeological === "high" ? "⌖ archaeological" : ring.visual.archaeological === "low" ? "△ modern feel" : null,
                            ring.visual.stone_color === "vivid" ? "◉ vivid color" : ring.visual.stone_color === "pale" ? "○ pale" : null,
                          ].filter(Boolean).map((t, j) => <span key={j} className="vtag">{t}</span>)}
                          {(ring.visual.condition_flags || []).map((f, j) => (
                            <span key={j} className="wtag">⚠ {f}</span>
                          ))}
                        </div>
                        {ring.visual.visual_summary && (
                          <p className="cg" style={{ fontSize: 12, color: "#6A8A68", lineHeight: 1.6, fontStyle: "italic", marginBottom: ring.visual.standout_detail ? 5 : 0 }}>
                            {ring.visual.visual_summary}
                          </p>
                        )}
                        {ring.visual.standout_detail && (
                          <p style={{ fontSize: 11, color: "#4A6A48", paddingTop: 5, borderTop: "1px solid #9CAF8810" }}>
                            <span style={{ color: "#9CAF8830", marginRight: 4 }}>✦</span>{ring.visual.standout_detail}
                          </p>
                        )}
                      </div>
                    )}

                    {ring.visual?.error && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#7A4A4A", padding: "6px 10px", background: "#180808", border: "1px solid #7B000015" }}>
                        Visual evaluation failed — {ring.visual.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty */}
          {rings.length === 0 && phase !== "searching" && !error && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div className="pf" style={{ fontSize: 34, color: "#C8A96E0C", letterSpacing: ".3em", marginBottom: 12 }}>✦</div>
              <p className="cg" style={{ color: "#3A3020", fontSize: 15, fontStyle: "italic" }}>Run a search to find new rings</p>
              <p style={{ color: "#1E1C14", fontSize: 11, marginTop: 6, letterSpacing: ".06em" }}>
                9 sources · text scoring + on-demand visual eye · 16k token search
              </p>
            </div>
          )}
        </>)}

        {/* ── QUEUE TAB ── */}
        {activeTab === "queue" && (
          <div>
            <p className="cg" style={{ fontSize: 14, color: "#5A5040", lineHeight: 1.65, marginBottom: 16 }}>
              Rings ready for the <em>New Finds</em> tab of your spreadsheet.
            </p>
            {queued.length === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 0" }}>
                <p className="cg" style={{ color: "#2A2618", fontStyle: "italic", fontSize: 14 }}>
                  No rings queued yet — search and click + on any card.
                </p>
              </div>
            ) : (<>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn-gold" onClick={downloadCSV}>
                  {copied ? "✓ Copied!" : `⎘ Copy CSV (${queued.length} ring${queued.length !== 1 ? "s" : ""})`}
                </button>
                <span style={{ fontSize: 11, color: "#3A3020" }}>Then paste into Numbers or Excel</span>
              </div>
              {queued.map((ring, i) => (
                <div key={ring.id || i} className="card fade" style={{ animationDelay: `${i * .04}s` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 className="pf" style={{ fontSize: 14, fontWeight: 400, color: "#EAE0C8", marginBottom: 3 }}>{ring.name}</h3>
                      <span style={{ fontSize: 11, color: "#5A5040" }}>
                        {ring.dealer} · {ring.price_display || `$${ring.price_usd}`} · Score {totalScore(ring)}
                      </span>
                      {ring.visual?.visual_summary && (
                        <p className="cg" style={{ fontSize: 12, color: "#4A5A40", marginTop: 5, fontStyle: "italic" }}>{ring.visual.visual_summary}</p>
                      )}
                    </div>
                    <button className="btn-sm" onClick={() => dequeue(ring.id)}
                      style={{ color: "#AA6666", borderColor: "#7B000018", marginLeft: 10 }}>×</button>
                  </div>
                </div>
              ))}
            </>)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #C8A96E08", padding: "11px 34px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#222018", letterSpacing: ".05em" }}>
        <span>Ring Finder v3 · Kathleen · 5.75 · 16k token search</span>
        <span>Gold ${goldSpot.toLocaleString()}/oz · 9 sources</span>
      </div>
    </div>
  );
}
