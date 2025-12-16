import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Proportion solver with Swap X
 * Supports:
 *   x / a = b / c   (x in numerator)
 *   a / x = b / c   (x in denominator)
 *
 * UI:
 * - Default left fraction: [blank + label] ABOVE the line, X BELOW the line
 * - Swap X sits inline with Solve/Reset
 * - Result carries the label attached to X (wherever X is placed)
 * - Shows a 1-sentence plain-language explanation after solving
 */

// Input rules (simple use-cases):
// - Non-negative only
// - Max 1 decimal place
// - Optional spaces while typing
// - No commas / scientific notation / letters

function stripSpaces(s) {
  var str = String(s == null ? "" : s);
  var out = "";
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") out += ch;
  }
  return out;
}

// Allow drafts while typing: "", ".", "12.", "12.3"
// Block: letters, commas, multiple dots, more than 1 digit after dot.
function sanitizeNumberDraft(next, prev) {
  if (typeof next !== "string") return prev;

  // Allow only digits, dot, and whitespace.
  for (var i = 0; i < next.length; i++) {
    var ch = next[i];
    var isDigit = ch >= "0" && ch <= "9";
    var isSpace = ch === " " || ch === "	" || ch === "  " || ch === "    ";
    if (!isDigit && ch !== "." && !isSpace) return prev;
  }

  var compact = stripSpaces(next);

  // Allow empty / in-progress
  if (compact === "" || compact === ".") return next;

  // Only one dot
  var dotPos = -1;
  for (var j = 0; j < compact.length; j++) {
    if (compact[j] === ".") {
      if (dotPos !== -1) return prev;
      dotPos = j;
    }
  }

  // Max one digit after dot
  if (dotPos !== -1) {
    var fracLen = compact.length - dotPos - 1;
    if (fracLen > 1) return prev;
  }

  return next;
}

// On blur: ".5" -> "0.5" and "." -> "0."
function autoZeroPrefixOnBlur(v) {
  var compact = stripSpaces(v);
  if (compact.length > 0 && compact[0] === ".") return "0" + compact;
  return v;
}

// "Complete" means solvable: digits only, optional dot with exactly 1 digit after.
function isCompleteNumberString(s) {
  var t = stripSpaces(s).trim();
  if (t === "" || t === ".") return false;
  if (t[t.length - 1] === ".") return false;

  var dotSeen = false;
  var fracLen = 0;
  for (var i = 0; i < t.length; i++) {
    var ch = t[i];
    if (ch === ".") {
      if (dotSeen) return false;
      dotSeen = true;
      continue;
    }
    if (ch < "0" || ch > "9") return false;
    if (dotSeen) fracLen++;
  }

  if (dotSeen && fracLen !== 1) return false;
  return true;
}

function parseNonNegativeNumber(s) {
  return Number(stripSpaces(s).trim());
}

/**
 * Pure solver (NO UI STRINGS HERE).
 * Returns only numeric results or errors.
 */
function solveProportion({ xPosition, a, b, c }) {
  const A = Number(a);
  const B = Number(b);
  const C = Number(c);

  if (!Number.isFinite(A) || !Number.isFinite(B) || !Number.isFinite(C)) {
    return { ok: false, error: "Please enter numbers for all three boxes." };
  }

  if (xPosition === "num") {
    // x / a = b / c
    if (C === 0) return { ok: false, error: "The right denominator can't be 0." };
    return { ok: true, x: (A * B) / C };
  }

  // a / x = b / c
  if (B === 0) return { ok: false, error: "The right numerator can't be 0." };
  return { ok: true, x: (A * C) / B };
}

function Fraction({ top, bottom, onTop, onBottom, topLabel, bottomLabel, onTopLabel, onBottomLabel, onKeyDown, onBlurTop, onBlurBottom }) {
  return (
    <span className="inline-flex flex-col items-center justify-center">
      <span className="inline-flex items-center gap-2">
        <Input
          value={top}
          onChange={(e) => onTop(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlurTop}
          placeholder="(blank)"
          inputMode="decimal"
          className="h-10 w-28 rounded-2xl text-center bg-background/80 border border-border/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Input
          value={topLabel}
          onChange={(e) => onTopLabel(e.target.value)}
          placeholder="label"
          className="h-7 w-20 rounded-xl text-xs text-muted-foreground bg-background/70 border border-border/50"
        />
      </span>
      <span className="my-1 h-px w-28 bg-border/70" />
      <span className="inline-flex items-center gap-2">
        <Input
          value={bottom}
          onChange={(e) => onBottom(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlurBottom}
          placeholder="(blank)"
          inputMode="decimal"
          className="h-10 w-28 rounded-2xl text-center bg-background/80 border border-border/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Input
          value={bottomLabel}
          onChange={(e) => onBottomLabel(e.target.value)}
          placeholder="label"
          className="h-7 w-20 rounded-xl text-xs text-muted-foreground bg-background/70 border border-border/50"
        />
      </span>
    </span>
  );
}

function XMark({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl bg-primary/10 px-2 py-0.5 font-semibold tracking-tight ring-1 ring-primary/40 text-primary">
      {children}
    </span>
  );
}
  
export default function App() {
  // Left numeric term (the blank)
  const [a, setA] = useState("");
  const [aLabel, setALabel] = useState("");

  // Right fraction terms
  const [b, setB] = useState("");
  const [bLabel, setBLabel] = useState("");
  const [c, setC] = useState("");
  const [cLabel, setCLabel] = useState("");

  // Label attached to X
  const [xTermLabel, setXTermLabel] = useState("");

  const [x, setX] = useState(null);
  const [xLabel, setXLabel] = useState("");
  const [error, setError] = useState("");

  // 'num' => x / a,  'den' => a / x
  const [xPosition, setXPosition] = useState("num");

  const canSolve = useMemo(() => {
    if (!isCompleteNumberString(a) || !isCompleteNumberString(b) || !isCompleteNumberString(c)) return false;
    const B = parseNonNegativeNumber(b);
    const C = parseNonNegativeNumber(c);
    return xPosition === "num" ? C !== 0 : B !== 0;
  }, [a, b, c, xPosition]);

  const solve = () => {
    // Don’t destroy prior work if solve fails.
    setError("");

    const res = solveProportion({
      xPosition,
      a: String(parseNonNegativeNumber(a)),
      b: String(parseNonNegativeNumber(b)),
      c: String(parseNonNegativeNumber(c)),
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setX(res.x);
    setXLabel(xTermLabel || "");
  };

  const reset = () => {
    setA("");
    setALabel("");
    setB("");
    setBLabel("");
    setC("");
    setCLabel("");
    setXTermLabel("");
    setX(null);
    setXLabel("");
    setError("");
    setXPosition("num");
  };

  // Plain-language explanation (locked wording)
  // Note: returns JSX so we can consistently emphasize X in the sentence.
  const explanation = useMemo(() => {
    if (x === null || error) return null;

    const aVal = stripSpaces(a);
    const bVal = stripSpaces(b);
    const cVal = stripSpaces(c);

    const aUnit = aLabel?.trim() || "";
    const bUnit = bLabel?.trim() || "";
    const cUnit = cLabel?.trim() || "";
    const xUnit = xLabel?.trim() || "";

    const aText = `${aVal}${aUnit ? ` ${aUnit}` : ""}`;
    const rateText = `${bVal}${bUnit ? ` ${bUnit}` : ""} per ${cVal}${cUnit ? ` ${cUnit}` : ""}`;
    const xText = `${Number.isFinite(x) ? x : "—"}${xUnit ? ` ${xUnit}` : ""}`;

    return (
      <span>
        This means that for every {aText}, you should have <XMark>{xText}</XMark> at the same rate as {rateText}.
      </span>
    );
  }, [x, error, a, b, c, aLabel, bLabel, cLabel, xLabel]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 text-center">
          <div className="text-sm text-muted-foreground">Solve for x</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Proportion</h1>
        </div>

        <div className="rounded-3xl border border-border/60 bg-background p-6 shadow-sm">
          <div className="flex flex-col items-center gap-6">
            {/* Equation line */}
            <div className="flex flex-wrap items-center justify-center gap-6">
              {/* Left fraction */}
              <span className="inline-flex flex-col items-center justify-center">
                <span className="inline-flex items-center gap-2">
                  {xPosition === "den" ? (
                    <>
                      <Input
                        value={a}
                        onChange={(e) => setA((prev) => sanitizeNumberDraft(e.target.value, prev))}
                        onBlur={() => setA((prev) => autoZeroPrefixOnBlur(prev))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canSolve) solve();
                          }
                        }}
                        placeholder="(blank)"
                        inputMode="decimal"
                        className="h-10 w-28 rounded-2xl text-center bg-background/80 border border-border/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                      <Input
                        value={aLabel}
                        onChange={(e) => setALabel(e.target.value)}
                        placeholder="label"
                        className="h-7 w-20 rounded-xl text-xs text-muted-foreground bg-background/70 border border-border/50"
                      />
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-28 rounded-2xl bg-primary/5 text-center text-lg font-semibold leading-10 ring-1 ring-primary/40">
                        x
                      </div>
                      <Input
                        value={xTermLabel}
                        onChange={(e) => setXTermLabel(e.target.value)}
                        placeholder="label"
                        className="h-7 w-20 rounded-xl text-xs text-muted-foreground bg-background/70 border border-border/50"
                      />
                    </>
                  )}
                </span>

                <span className="my-1 h-px w-28 bg-border" />

                <span className="inline-flex items-center gap-2">
                  {xPosition === "den" ? (
                    <>
                      <div className="h-10 w-28 rounded-2xl bg-primary/5 text-center text-lg font-semibold leading-10 ring-1 ring-primary/40">
                        x
                      </div>
                      <Input
                        value={xTermLabel}
                        onChange={(e) => setXTermLabel(e.target.value)}
                        placeholder="label"
                        className="h-7 w-20 rounded-xl text-xs text-muted-foreground bg-background/70 border border-border/50"
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        value={a}
                        onChange={(e) => setA((prev) => sanitizeNumberDraft(e.target.value, prev))}
                        onBlur={() => setA((prev) => autoZeroPrefixOnBlur(prev))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canSolve) solve();
                          }
                        }}
                        placeholder="(blank)"
                        inputMode="decimal"
                        className="h-10 w-28 rounded-2xl text-center bg-background/80 border border-border/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                      <Input
                        value={aLabel}
                        onChange={(e) => setALabel(e.target.value)}
                        placeholder="label"
                        className="h-7 w-20 rounded-xl text-xs text-muted-foreground bg-background/70 border border-border/50"
                      />
                    </>
                  )}
                </span>
              </span>

              <span className="text-3xl font-semibold">=</span>

              <Fraction
                top={b}
                bottom={c}
                onTop={(val) => setB((prev) => sanitizeNumberDraft(val, prev))}
                onBottom={(val) => setC((prev) => sanitizeNumberDraft(val, prev))}
                topLabel={bLabel}
                bottomLabel={cLabel}
                onTopLabel={setBLabel}
                onBottomLabel={setCLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (canSolve) solve();
                  }
                }}
                onBlurTop={() => setB((prev) => autoZeroPrefixOnBlur(prev))}
                onBlurBottom={() => setC((prev) => autoZeroPrefixOnBlur(prev))}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={() => {
                  // If you swap x after a solve, clear the result.
                  if (x !== null) {
                    setX(null);
                    setXLabel("");
                  }
                  setError("");
                  setXPosition((p) => (p === "num" ? "den" : "num"));
                }}
              >
                Swap X
              </Button>
              <Button className="rounded-2xl" onClick={solve} disabled={!canSolve}>Solve for x</Button>
              <Button variant="secondary" className="rounded-2xl" onClick={reset}>Reset</Button>
            </div>

            <div className="min-h-[28px] text-center">
              {error ? (
                <div className="text-sm text-destructive">{error}</div>
              ) : x !== null ? (
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="secondary" className="rounded-xl">Result</Badge>
                  <div className="text-lg font-semibold">
                    <XMark>x</XMark> = <XMark>{Number.isFinite(x) ? x : "—"}{xLabel ? ` ${xLabel}` : ""}</XMark>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Enter values and click Solve.</div>
              )}
            </div>

            {x !== null && !error && explanation && (
              <div className="mt-2 max-w-xl text-center text-sm text-muted-foreground">{explanation}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Dev-time sanity checks
if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
  console.assert(solveProportion({ xPosition: "num", a: "2", b: "12", c: "3" }).x === 8);
  console.assert(solveProportion({ xPosition: "den", a: "150", b: "3", c: "1" }).x === 50);
}
