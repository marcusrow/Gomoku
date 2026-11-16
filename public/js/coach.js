// Coach mode: grades each of the human's moves right after it is played.
//
// Before the move is committed the engine analyses the position (best move + its value). Once the engine
// has replied, its value for the new position tells how much win probability the move gave up.
import { HINT_MS, MATE_BASE } from './config.js';
import { S } from './state.js';
import { engine } from './engine.js';
import { bestMoveOf, boardCmd, fmtWin, isBestMove, label, makeParser, searchSetup, winProb } from './protocol.js';
import { checkWin } from './rules.js';
import { setBusy } from './ui.js';
import { classify } from './review.js';
import { render } from './render.js';

/** Searches the current position (human to move). Resolves {best, E} (E = mover's value, may be null). */
export async function preAnalyze() {
  setBusy(true, 'Checking your move…');
  const parser = makeParser();
  const lines = await engine.ask(
    [...searchSetup(S.rule, HINT_MS, 99), S.moves.length ? boardCmd('YXBOARD', S.moves) : 'RESTART', 'YXNBEST 1'],
    isBestMove,
    (l) => parser.feed(l),
  );
  const best = bestMoveOf(lines);
  let E = parser.st.eval;
  if (E == null) {
    // No search output: the engine returned an immediate win.
    const win = checkWin(S.moves.concat(best), S.rule);
    if (win && win.winner === S.human) E = MATE_BASE - 1;
  }
  return { best, E };
}

/**
 * Grades the move stored in S.coach. `engineEval` is the engine's value (its own point of view) for the
 * position after the human's move; null when the game ended or there was no search.
 */
export function finishCoach(engineEval) {
  const c = S.coach;
  S.coach = null;
  if (!c || c.E == null) return;
  const humanWon = S.gameOver && S.gameOver.winner === S.human;
  if (!humanWon && engineEval == null) return;
  const same = c.best.x === c.played.x && c.best.y === c.played.y;
  const before = winProb(c.E);
  const after = humanWon ? 1 : 1 - winProb(engineEval);
  const loss = same ? 0 : Math.max(0, before - after);
  const cls = classify(loss);

  const verdict = same ? 'Best move!' : cls ? `${cls.name} (−${Math.round(loss * 100)}%)` : 'Fine — almost as good as the best.';
  S.coachText =
    `Your move ${label(c.played)}: ${verdict}\n` +
    `Win chance ${fmtWin(c.E)} → ${Math.round(after * 100)}%` +
    (same ? '' : ` · engine preferred ${label(c.best)} (${fmtWin(c.E)})`);
  if (!same && !S.moves.some((m) => m.x === c.best.x && m.y === c.best.y)) {
    S.overlay = [{ x: c.best.x, y: c.best.y, text: '★' }];
  }
  render();
}
