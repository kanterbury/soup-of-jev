"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ChevronLeft, Logo, PrivacyNote } from "@/components/Ornaments";
import { TruthCard } from "@/components/TruthCard";
import { VerdictLabel } from "@/components/VerdictLabel";
import type { Verdict } from "@/lib/judge";
import { clearProgress, loadProgress, markHowtoSeen, saveProgress, useHowtoSeen, useProgress, type Progress } from "@/lib/progress";
import type { PublicPuzzle } from "@/lib/puzzles";

// サーバー側（src/app/api）の上限と合わせる
const MAX_QUESTION_LENGTH = 200;
const MAX_ANSWER_LENGTH = 500;

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: typeof json.error === "string" ? json.error : "判定に失敗しました" };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "通信に失敗しました。接続を確かめてから、もう一度送ってください" };
  }
}

/** 保存するときは、画面の値ではなく最新の保存内容に足す（別のタブで進めた分を消さないため） */
function latest(puzzleId: string): Progress {
  return loadProgress(puzzleId) ?? { log: [], status: "playing" };
}

export function PlayView({ puzzle, number }: { puzzle: PublicPuzzle; number: number }) {
  const progress = useProgress(puzzle.id);
  const howtoSeen = useHowtoSeen();
  const [showLog, setShowLog] = useState(false);
  const revealDialog = useRef<HTMLDialogElement>(null);
  const restartDialog = useRef<HTMLDialogElement>(null);
  const [revealError, setRevealError] = useState<string>();
  const [revealing, setRevealing] = useState(false);

  const log = progress?.log ?? [];
  const finished = progress?.status === "solved" || progress?.status === "gave-up";

  async function reveal() {
    if (revealing) return;
    setRevealing(true);
    setRevealError(undefined);
    const result = await postJson<{ truth: string }>("/api/reveal", { puzzleId: puzzle.id });
    setRevealing(false);
    if (!result.ok) {
      setRevealError(result.error);
      return;
    }
    revealDialog.current?.close();
    saveProgress(puzzle.id, { ...latest(puzzle.id), status: "gave-up", truth: result.data.truth });
    window.scrollTo({ top: 0 });
  }

  function restart() {
    restartDialog.current?.close();
    clearProgress(puzzle.id);
    setShowLog(false);
    window.scrollTo({ top: 0 });
  }

  const header = (
    <header className="flex items-center justify-between gap-2 border-b border-gold/30 py-2.5 pr-3 pl-1.5 sm:gap-6 sm:px-0 sm:pt-0 sm:pb-[18px]">
      <Link href="/" aria-label="問題一覧に戻る" className="inline-flex h-11 min-w-11 items-center justify-center gap-2 text-sm tracking-[0.06em] no-underline sm:justify-start">
        <ChevronLeft className="size-5 sm:size-4" />
        <span className="hidden sm:inline">問題一覧</span>
      </Link>
      <div className="hidden sm:block">
        <Logo />
      </div>
      <h1 className="m-0 grow font-display text-lg font-extrabold text-ivory sm:hidden">{puzzle.title}</h1>
      {progress !== undefined && !finished ? (
        <button
          type="button"
          className="btn-secondary hidden text-sm sm:inline-flex"
          onClick={() => {
            setRevealError(undefined);
            revealDialog.current?.showModal();
          }}
        >
          真相を見る
        </button>
      ) : (
        <span className="hidden w-[108px] sm:block" />
      )}
    </header>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col sm:gap-7 sm:px-8 sm:pt-7 sm:pb-10 lg:px-14">
      {header}

      {progress === undefined ? null : finished && progress.truth ? (
        <div className="flex flex-col gap-10 px-4 py-8 sm:px-0 sm:py-6">
          <TruthCard title={puzzle.title} truth={progress.truth} solved={progress.status === "solved"}>
            <Link href="/" className="btn-primary min-h-12 px-[26px]">
              次の謎を選ぶ
            </Link>
            {log.length > 0 && (
              <button type="button" className="btn-secondary min-h-12 px-[22px]" onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}>
                {showLog ? "質問の記録を閉じる" : "質問の記録を見る"}
              </button>
            )}
            <button type="button" className="btn-secondary min-h-12 px-[22px]" onClick={() => restartDialog.current?.showModal()}>
              やり直す
            </button>
          </TruthCard>
          {showLog && (
            <section className="mx-auto flex w-full max-w-[760px] flex-col gap-3">
              <QuestionsHeading count={log.length} />
              <QuestionLog log={log} />
            </section>
          )}
        </div>
      ) : (
        <PlayingView
          puzzle={puzzle}
          number={number}
          log={log}
          howtoSeen={howtoSeen}
          onRevealClick={() => {
            setRevealError(undefined);
            revealDialog.current?.showModal();
          }}
        />
      )}

      <ConfirmDialog
        dialogRef={revealDialog}
        message="真相を見ると、この問題は終了します。よろしいですか？"
        confirmLabel={revealing ? "読み込み中…" : "真相を見る"}
        busy={revealing}
        error={revealError}
        onConfirm={reveal}
      />
      <ConfirmDialog
        dialogRef={restartDialog}
        message="この問題の質問の記録を消して、最初からやり直します。よろしいですか？"
        confirmLabel="やり直す"
        onConfirm={restart}
      />
    </div>
  );
}

function PlayingView({
  puzzle,
  number,
  log,
  howtoSeen,
  onRevealClick,
}: {
  puzzle: PublicPuzzle;
  number: number;
  log: Progress["log"];
  howtoSeen: boolean;
  onRevealClick: () => void;
}) {
  const [problemExpanded, setProblemExpanded] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);

  return (
    <div className="flex grow flex-col gap-0 lg:grid lg:grid-cols-[500px_minmax(0,1fr)] lg:gap-10">
      <aside className="flex flex-col gap-4 px-3.5 pt-3.5 sm:gap-6 sm:px-0 sm:pt-0">
        <section className="frame-double flex flex-col gap-2 px-4 pt-4 pb-3 sm:gap-3.5 sm:px-7 sm:pt-7 sm:pb-[26px]">
          <div className="label-caps hidden text-gold-muted sm:block">THE MYSTERY · No. {number}</div>
          <h2 className="m-0 hidden font-display text-[30px] leading-[1.3] font-extrabold text-ivory sm:block">{puzzle.title}</h2>
          <p
            className={`m-0 font-display text-[14.5px] leading-[1.85] font-semibold text-ivory sm:line-clamp-none sm:text-[17px] sm:leading-loose ${
              problemExpanded ? "" : "line-clamp-3"
            }`}
          >
            {puzzle.problem}
          </p>
          <button
            type="button"
            className="h-8 cursor-pointer self-end border-0 bg-transparent px-1 text-[13px] text-gold hover:text-gold-light sm:hidden"
            onClick={() => setProblemExpanded((v) => !v)}
            aria-expanded={problemExpanded}
          >
            {problemExpanded ? "閉じる" : "問題の全文"}
          </button>
        </section>

        <button
          type="button"
          className="btn-primary sm:hidden"
          onClick={() => setAnswerOpen((v) => !v)}
          aria-expanded={answerOpen}
          aria-controls="answer-panel"
        >
          {answerOpen ? "回答欄を閉じる" : "真相がわかったら回答する"}
        </button>
        <div id="answer-panel" className={answerOpen ? "flex flex-col gap-3" : "hidden sm:flex sm:flex-col"}>
          <AnswerPanel puzzleId={puzzle.id} />
          <button type="button" className="btn-secondary sm:hidden" onClick={onRevealClick}>
            真相を見る
          </button>
        </div>
      </aside>

      <QuestionsPanel puzzleId={puzzle.id} log={log} howtoSeen={howtoSeen} />
    </div>
  );
}

function QuestionsHeading({ count }: { count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="label-caps m-0 text-gold sm:text-[15px] sm:tracking-[0.28em]">QUESTIONS</h2>
      <span className="text-xs text-dim sm:text-[13px]">
        質問 <span className="font-label text-sm text-ivory sm:text-base">{count}</span>
      </span>
    </div>
  );
}

function QuestionLog({ log }: { log: Progress["log"] }) {
  const endRef = useRef<HTMLLIElement>(null);
  const count = useRef(log.length);
  // 質問が増えたら、最新の質問が見えるようにする
  useEffect(() => {
    if (log.length > count.current) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    count.current = log.length;
  }, [log.length]);

  if (log.length === 0) {
    return <p className="m-0 border-t border-gold/25 py-6 text-center text-sm text-dim">まだ質問はありません。</p>;
  }
  return (
    <ol className="m-0 flex list-none flex-col border-t border-gold/25 p-0">
      {log.map(({ question, verdict }, i) => (
        <li
          key={i}
          ref={i === log.length - 1 ? endRef : undefined}
          className="flex items-center justify-between gap-3 border-b border-gold/16 px-1 py-3 sm:grid sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:gap-4 sm:py-4"
        >
          <span
            className={`hidden font-label text-sm font-semibold tracking-[0.12em] sm:inline ${verdict === "invalid" ? "text-gold-muted/60" : "text-gold-muted"}`}
          >
            Q.{i + 1}
          </span>
          <span className={`text-[14.5px] leading-[1.55] break-words sm:text-base sm:leading-[1.6] ${verdict === "invalid" ? "text-dim" : "text-ivory"}`}>
            {question}
          </span>
          <VerdictLabel verdict={verdict} />
        </li>
      ))}
    </ol>
  );
}

function QuestionsPanel({ puzzleId, log, howtoSeen }: { puzzleId: string; log: Progress["log"]; howtoSeen: boolean }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = question.trim();
  const canSend = !asking && trimmed.length > 0 && trimmed.length <= MAX_QUESTION_LENGTH;

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setAsking(true);
    setError(undefined);
    const result = await postJson<{ verdict: Verdict }>("/api/ask", { puzzleId, question: trimmed });
    setAsking(false);
    if (!result.ok) {
      // 入力は消さずに残し、そのまま送り直せるようにする
      setError(result.error);
      return;
    }
    const current = latest(puzzleId);
    saveProgress(puzzleId, { ...current, log: [...current.log, { question: trimmed, verdict: result.data.verdict }] });
    setQuestion("");
    inputRef.current?.focus();
  }

  return (
    <section className="flex grow flex-col gap-2 pt-4 sm:gap-4 lg:pt-0">
      <div className="px-[18px] sm:px-0">
        <QuestionsHeading count={log.length} />
      </div>

      {!howtoSeen && (
        <div className="mx-3.5 flex flex-col gap-3 border border-gold/45 bg-[rgb(26_3_9/0.6)] px-5 py-4 sm:mx-0">
          <div className="label-caps text-gold">HOW TO PLAY</div>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-rose">
            <li>YES か NO で答えられる質問をして、真相を推理してください。AI が「YES／NO／どちらともいえない」で答えます。</li>
            <li>「〜ではないのですか？」のような聞き方は答えがぶれやすいので、「〜ですか？」と肯定の形で聞いてください。</li>
            <li>真相がわかったら、回答欄に書いて送ってください。</li>
          </ul>
          <button type="button" className="btn-secondary self-end text-sm" onClick={markHowtoSeen}>
            はじめる
          </button>
        </div>
      )}

      <div className="grow px-3.5 sm:px-0">
        <QuestionLog log={log} />
      </div>

      <form
        onSubmit={ask}
        className="sticky bottom-0 flex flex-col gap-2.5 border-t border-gold/50 bg-[rgb(26_3_9/0.92)] px-3 pt-3 pb-5 sm:static sm:border sm:bg-[rgb(26_3_9/0.7)] sm:px-5 sm:py-[18px]"
      >
        <label htmlFor="question" className="sr-only text-[13px] text-rose-muted sm:not-sr-only">
          YES か NO で答えられる質問をどうぞ。「〜ではないのですか？」より、肯定形で聞くと答えがぶれにくくなります。
        </label>
        <div className="flex gap-2 sm:gap-3">
          <input
            ref={inputRef}
            id="question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={preventImeSubmit}
            maxLength={MAX_QUESTION_LENGTH + 20}
            placeholder="YES か NO で答えられる質問"
            autoComplete="off"
            className="field h-12 min-w-0 grow px-3.5 text-base sm:px-4"
          />
          <button type="submit" disabled={!canSend} className="btn-primary min-h-12 px-[18px] tracking-[0.1em] sm:px-[26px]">
            {asking ? "判定中…" : "問う"}
          </button>
        </div>
        <div className="flex items-start justify-between gap-3">
          <p role="alert" className="m-0 text-[13px] text-rose">
            {error}
          </p>
          <span
            className={`shrink-0 font-label text-xs tracking-[0.06em] ${trimmed.length > MAX_QUESTION_LENGTH ? "text-gold-light" : "text-dim"}`}
          >
            {trimmed.length} / {MAX_QUESTION_LENGTH}
          </span>
        </div>
        <PrivacyNote className="text-xs" />
      </form>
    </section>
  );
}

function AnswerPanel({ puzzleId }: { puzzleId: string }) {
  const [answer, setAnswer] = useState("");
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ matched: number; total: number }>();
  const trimmed = answer.trim();
  const canSend = !solving && trimmed.length > 0 && trimmed.length <= MAX_ANSWER_LENGTH;

  async function solve(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSolving(true);
    setError(undefined);
    setResult(undefined);
    const res = await postJson<{ solved: boolean; matched: number; total: number; truth?: string }>("/api/solve", {
      puzzleId,
      answer: trimmed,
    });
    setSolving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.solved && res.data.truth) {
      saveProgress(puzzleId, { ...latest(puzzleId), status: "solved", truth: res.data.truth });
      window.scrollTo({ top: 0 });
      return;
    }
    setResult({ matched: res.data.matched, total: res.data.total });
  }

  return (
    <form onSubmit={solve} className="flex flex-col gap-3 border border-gold/35 bg-[rgb(26_3_9/0.45)] px-4 py-4 sm:px-6 sm:py-[22px]">
      <label htmlFor="answer" className="label-caps text-gold">
        YOUR ANSWER
      </label>
      <textarea
        id="answer"
        rows={3}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        maxLength={MAX_ANSWER_LENGTH + 50}
        placeholder="真相だと思う物語を書いてください"
        className="field w-full resize-none border-gold/45 px-3.5 py-3 text-[15px] leading-[1.7]"
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-rose" role="status">
          {result && (
            <>
              {result.total} つの要点のうち <strong className="font-label text-lg text-gold">{result.matched}</strong> つに触れています
            </>
          )}
          {error && <span role="alert">{error}</span>}
          {!result && !error && (
            <span className={`font-label text-xs tracking-[0.06em] ${trimmed.length > MAX_ANSWER_LENGTH ? "text-gold-light" : "text-dim"}`}>
              {trimmed.length} / {MAX_ANSWER_LENGTH}
            </span>
          )}
        </div>
        <button type="submit" disabled={!canSend} className="btn-primary ml-auto">
          {solving ? "判定中…" : "回答する"}
        </button>
      </div>
    </form>
  );
}

function ConfirmDialog({
  dialogRef,
  message,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  message: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="frame-double fixed inset-0 m-auto w-[min(440px,calc(100vw-32px))] bg-velvet px-6 pt-7 pb-6 text-ivory backdrop:bg-[rgb(10_0_3/0.7)]"
    >
      <p className="m-0 text-[15px] leading-relaxed">{message}</p>
      {error && (
        <p role="alert" className="mt-3 mb-0 text-[13px] text-rose">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>
          やめる
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/** 日本語入力の変換を確定する Enter で送信しないようにする */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
}
