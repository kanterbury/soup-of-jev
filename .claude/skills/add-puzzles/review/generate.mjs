// 期待値のレビュー用ページを、リポジトリの問題データと評価ケースから生成する。
//
//   node .claude/skills/add-puzzles/review/generate.mjs \
//     --puzzles=exam,april --round=2026-10-01-1 --out=<scratchpad>/review.html \
//     [--new=exam] [--doubts=<scratchpad>/doubts.json] [--intro="この回で見てほしいこと"]
//
// --puzzles  載せる問題の id（並べた順に表示する）
// --round    レビューの回の名前。印とメモの保存先（marks-<round> / progress-<round>）になるので、回ごとに変える
// --new      「新作」の札を付ける id。省略するとすべて新作
// --doubts   Claude が迷った行。{ "<問題 id>|<質問文 または 回答文>": "迷った理由" } の JSON
// --intro    ページ冒頭に足す説明（この回で何が変わったか、など）
//
// リポジトリのルートで実行する。
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=")];
  }),
);
for (const key of ["puzzles", "round", "out"]) {
  if (!args[key]) throw new Error(`--${key} を指定してください`);
}
if (!/^[A-Za-z0-9_\-.~]+$/.test(args.round))
  throw new Error("--round は英数字と - _ . ~ だけで付けてください");

const ids = args.puzzles.split(",");
const newIds = new Set(args.new ? args.new.split(",") : ids);
const doubts = args.doubts ? JSON.parse(readFileSync(args.doubts, "utf8")) : {};
const escapeHtml = (s) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const used = new Set();
const doubtOf = (id, text) => {
  const key = `${id}|${text}`;
  if (!(key in doubts)) return null;
  used.add(key);
  return doubts[key];
};

const puzzles = ids.map((id) => {
  const p = JSON.parse(
    readFileSync(path.join("data/puzzles", `${id}.json`), "utf8"),
  );
  const c = JSON.parse(
    readFileSync(path.join("eval/cases", `${id}.json`), "utf8"),
  );
  return {
    id,
    isNew: newIds.has(id),
    split: c.split,
    title: p.title,
    problem: p.problem,
    truth: p.truth,
    facts: p.facts,
    keyPoints: p.keyPoints,
    questions: c.questions.map((q, i) => ({
      i,
      ...q,
      doubt: doubtOf(id, q.question),
    })),
    solutions: c.solutions.map((s, i) => ({
      i,
      ...s,
      doubt: doubtOf(id, s.answer),
    })),
  };
});

const unmatched = Object.keys(doubts).filter((k) => !used.has(k));
if (unmatched.length)
  throw new Error(
    `評価ケースに見つからない迷いがあります（文言を確かめてください）:\n${unmatched.join("\n")}`,
  );

const template = readFileSync(
  new URL("./template.html", import.meta.url),
  "utf8",
);
const html = template
  .replace("__DATA__", JSON.stringify(puzzles).replace(/</g, "\\u003c"))
  .replaceAll("__ROUND__", args.round)
  .replace(
    "__INTRO__",
    args.intro
      ? `<p><strong>この回について：</strong>${escapeHtml(args.intro)}</p>`
      : "",
  );
writeFileSync(args.out, html);
console.log(
  `${args.out} を書き出した（${ids.length} 問、迷い ${used.size} 件、保存先 marks-${args.round} / progress-${args.round}）`,
);
