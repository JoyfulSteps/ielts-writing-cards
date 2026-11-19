// Search core for IELTS Writing Cards. Pure (no DOM), so it runs in the page and in node tests.
(function (root) {
  "use strict";

  const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();
  const ENT = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#x27;": "'" };
  const plain = (h) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/&(lt|gt|amp|quot|#x27);/g, (m) => ENT[m]);

  // Vietnamese writing words → English words used on the cards (all folded, no accents).
  // The cards are half Vietnamese, so the Vietnamese words are searched as they are too.
  const VI = [
    ["mo bai", ["introduction"]],
    ["ket bai", ["conclusion"]],
    ["ket luan", ["conclusion"]],
    ["than bai", ["body paragraph"]],
    ["doan than", ["body paragraph"]],
    ["tong quan", ["overview"]],
    ["xu huong", ["trend"]],
    ["bieu do duong", ["line graph"]],
    ["bieu do cot", ["bar chart"]],
    ["bieu do tron", ["pie chart"]],
    ["quy trinh", ["process"]],
    ["ban do", ["map"]],
    ["bang", ["table"]],
    ["tu noi", ["linking"]],
    ["lien ket", ["linking", "cohesion"]],
    ["mach lac", ["coherence"]],
    ["dien dat lai", ["paraphrase"]],
    ["viet lai", ["paraphrase"]],
    ["dong y", ["agree"]],
    ["phan doi", ["disagree"]],
    ["quan diem", ["opinion"]],
    ["y kien", ["opinion"]],
    ["thao luan", ["discussion"]],
    ["giai phap", ["solution"]],
    ["van de", ["problem"]],
    ["nguyen nhan", ["cause"]],
    ["hau qua", ["effect"]],
    ["loi ich", ["advantage", "benefit"]],
    ["bat loi", ["disadvantage"]],
    ["nhuoc diem", ["disadvantage"]],
    ["uu diem", ["advantage"]],
    ["so sanh", ["compare", "comparison"]],
    ["ty le", ["proportion", "percentage"]],
    ["ti le", ["proportion", "percentage"]],
    ["phan tram", ["percentage"]],
    ["tang", ["increase", "rise"]],
    ["giam", ["decrease", "decline", "fall"]],
    ["dao dong", ["fluctuate"]],
    ["on dinh", ["stable"]],
    ["dinh", ["peak"]],
    ["nhuong bo", ["concession"]],
    ["phan bien", ["counter argument"]],
    ["cau phuc", ["complex sentence"]],
    ["menh de quan he", ["relative clause"]],
    ["bi dong", ["passive"]],
    ["dieu kien", ["conditional"]],
    ["cum tu", ["collocation"]],
    ["tu vung", ["vocabulary", "lexical"]],
    ["ngu phap", ["grammar"]],
    ["thoi gian", ["time"]],
    ["giao duc", ["education"]],
    ["suc khoe", ["health"]],
    ["moi truong", ["environment"]],
    ["cong nghe", ["technology"]],
    ["xa hoi", ["society"]],
    ["kinh te", ["economy"]],
    ["chinh phu", ["government"]],
    ["toi pham", ["crime"]],
  ];
  // Spellings that mean the same thing on these cards.
  const SAME = [["task 1", "task1"], ["task 2", "task2"], ["line graph", "line chart"], ["bar chart", "bar graph"],
    ["pie chart", "pie graph"], ["counter argument", "counterargument"]];

  const pad = (s) => " " + s + " ";
  function expand(qn) {
    const out = new Set([qn]);
    for (const [vi, ens] of VI) if (pad(qn).includes(pad(vi))) for (const en of ens) out.add(pad(qn).replace(pad(vi), pad(en)).trim());
    for (const v of [...out]) for (const [a, b] of SAME) {
      if (pad(v).includes(pad(a))) out.add(pad(v).replace(pad(a), pad(b)).trim());
      if (pad(v).includes(pad(b))) out.add(pad(v).replace(pad(b), pad(a)).trim());
    }
    return [...out];
  }

  // Card codes: "W3D2-S-01", "w3d2s1", "w3 d2 p4", "W3D2" (lesson), "W00-P-05", "w0p5", "W00".
  // A week number alone ("w3") is not a lesson; "w0" is, because W00 has no days.
  const CODE = /^\s*w\s*0*(\d{1,2})\s*[-\s]*(?:d\s*0*(\d))?(?:\s*[-\s]?\s*([spe])\s*[-\s]?\s*0*(\d{1,3}))?\s*$/i;
  const CODE_ANY = /\bw\s*0*(\d{1,2})\s*-?\s*d\s*0*(\d)(?:\s*-?\s*([spe])\s*-?\s*0*(\d{1,3}))?/i;
  function parseCode(q) {
    const m = CODE.exec(q) || CODE_ANY.exec(q);
    if (!m) return null;
    return { week: +m[1], day: m[2] ? +m[2] : null, type: m[3] ? m[3].toUpperCase() : null, num: m[4] ? +m[4] : null };
  }
  const lessonCodeOf = (week, day) => (week === 0 ? "W00" : day ? `W${week}D${day}` : null);

  function createIndex(data) {
    const rows = data.cards.map((c) => ({
      front: " " + norm(plain(c.f)) + " ",
      key: " " + norm(plain(c.a)) + " ",
      tags: c.tags.map((t) => norm(t)),
      tagText: " " + norm(c.tags.join(" ")) + " ",
      body: " " + norm(plain(c.b)) + " ",
    }));
    const byId = new Map(data.cards.map((c, i) => [c.id, i]));
    const lessonAt = new Map(data.lessons.map((l, i) => [l.c, i]));
    return { data, rows, byId, lessonAt, lessonTitle: data.lessons.map((l) => " " + norm(l.t) + " ") };
  }

  // A phrase matches when it starts at a word boundary; the last word may be unfinished (typing "intro").
  const has = (text, q) => text.includes(" " + q);
  const hasWord = (text, q) => text.includes(" " + q + " ");
  const allWords = (text, words) => words.every((w) => has(text, w));

  function tierOf(r, q) {
    const words = q.split(" ");
    if (r.tags.includes(q)) return 1;
    if (hasWord(r.key, q)) return 2;
    if (hasWord(r.front, q)) return 3;
    if (has(r.front, q) || has(r.key, q)) return 4;
    if (allWords(r.tagText, words)) return 5;
    if (hasWord(r.body, q)) return 6;
    if (words.length > 1 && allWords(r.front + r.key + r.tagText, words)) return 7;
    if (has(r.body, q)) return 8;
    if (words.length > 1 && allWords(r.front + r.key + r.tagText + r.body, words)) return 9;
    return 0;
  }

  // Returns { kind: "card" | "lesson" | "text" | "none", card, lesson, hits: [{ i, tier }], lessons: [lesson index] }
  function search(index, query, opts = {}) {
    const keep = opts.filter || (() => true);
    const q = String(query ?? "").trim();
    if (!q) return { kind: "none", hits: [], lessons: [] };
    const code = parseCode(q);
    if (code) {
      const lc = lessonCodeOf(code.week, code.day);
      const li = lc ? index.lessonAt.get(lc) : undefined;
      if (li !== undefined) {
        if (code.type && code.num !== null) {
          const i = index.byId.get(`${lc}-${code.type}-${String(code.num).padStart(2, "0")}`);
          if (i !== undefined) return { kind: "card", card: i, hits: [{ i, tier: 0 }], lessons: [li] };
        }
        if (CODE.test(q) && !code.type) return { kind: "lesson", lesson: li, hits: [], lessons: [li] };
      }
    }
    const qn = norm(q);
    if (!qn) return { kind: "none", hits: [], lessons: [] };
    const alts = expand(qn);
    const hits = [];
    index.rows.forEach((r, i) => {
      if (!keep(index.data.cards[i])) return;
      let best = 0;
      for (const a of alts) { const t = tierOf(r, a); if (t && (!best || t < best)) best = t; }
      if (best) hits.push({ i, tier: best });
    });
    hits.sort((a, b) => a.tier - b.tier || a.i - b.i);
    const lessons = [];
    index.lessonTitle.forEach((t, li) => { if (alts.some((a) => has(t, a))) lessons.push(li); });
    return { kind: "text", hits, lessons };
  }

  const api = { fold, norm, plain, expand, parseCode, createIndex, search };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WritingSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
