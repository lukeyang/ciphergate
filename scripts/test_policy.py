#!/usr/bin/env python3
"""
CipherGate Policy Classifier Test Runner

Tests local keyword-based policy scoring by replicating the TypeScript
local-policy.ts logic in Python. No server or embedding API required.

Usage:
    python scripts/test_policy.py
    python scripts/test_policy.py --verbose
    python scripts/test_policy.py --filter harassment
    python scripts/test_policy.py --filter BLOCK
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
POLICY_FILE   = ROOT / "config/policy/local-policy.json"
THRESH_FILE   = ROOT / "config/policy/decision-thresholds.json"
CASES_FILE    = Path(__file__).resolve().parent / "test_cases.json"


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_patterns(raw: list[str]) -> list[re.Pattern]:
    compiled = []
    for p in raw:
        try:
            compiled.append(re.compile(p, re.IGNORECASE))
        except re.error as e:
            print(f"  [WARN] Bad pattern '{p}': {e}")
    return compiled


def score_category(text: str, patterns: list[re.Pattern], weight: float) -> tuple[float, int, list[str]]:
    matches_total = 0
    matched = []
    for pat in patterns:
        found = pat.findall(text)
        if found:
            matches_total += len(found)
            matched.append(pat.pattern)
    keyword_curve = 1.0 - math.exp(-matches_total * weight)
    return keyword_curve, matches_total, matched


def has_pattern_match(text: str, patterns: list[re.Pattern]) -> bool:
    return any(pat.search(text) for pat in patterns)


def repeated_abuse_boost(text: str, min_token_len: int, min_count: int, boost: float) -> float:
    tokens = [t for t in text.split() if len(t) >= min_token_len]
    counts: dict[str, int] = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    repeated = sum(1 for c in counts.values() if c >= min_count)
    return boost if repeated > 0 else 0.0


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def evaluate(message: str, tuning: dict, thresholds: dict) -> dict:
    lower = message.lower()

    h_pats = load_patterns(tuning["patterns"]["harassment"])
    t_pats = load_patterns(tuning["patterns"]["threat"])
    s_pats = load_patterns(tuning["patterns"]["sexual"])
    hc_pats = load_patterns(tuning["patterns"]["harassmentCritical"])
    tc_pats = load_patterns(tuning["patterns"]["threatCritical"])

    rep_boost = repeated_abuse_boost(
        lower,
        tuning["repetition"]["minTokenLength"],
        tuning["repetition"]["minCountPerToken"],
        tuning["weights"]["repeatedAbuseBoost"],
    )

    h_kw, h_cnt, h_matched = score_category(lower, h_pats, tuning["weights"]["keyword"]["harassment"])
    t_kw, t_cnt, t_matched = score_category(lower, t_pats, tuning["weights"]["keyword"]["threat"])
    s_kw, s_cnt, s_matched = score_category(lower, s_pats, tuning["weights"]["keyword"]["sexual"])

    hc_boost = tuning["weights"]["harassmentCriticalBoost"] if has_pattern_match(lower, hc_pats) else 0.0
    tc_boost = tuning["weights"]["threatCriticalBoost"] if has_pattern_match(lower, tc_pats) else 0.0

    kw_weight = tuning["weights"]["combine"]["keyword"]   # 0.82
    sem_weight = tuning["weights"]["combine"]["semantic"]  # 0.18  (semantic = 0 here)

    h_combined = clamp01(kw_weight * clamp01(h_kw + rep_boost + hc_boost) + sem_weight * 0)
    t_combined = clamp01(kw_weight * clamp01(t_kw + rep_boost + tc_boost) + sem_weight * 0)
    s_combined = clamp01(kw_weight * clamp01(s_kw + rep_boost) + sem_weight * 0)

    scores = {"harassment": h_combined, "threat": t_combined, "sexual": s_combined}

    category = max(scores, key=scores.__getitem__)
    best_score = scores[category]
    threshold = thresholds["thresholds"].get(category, 0.7)
    decision = "BLOCK" if best_score >= threshold else "ALLOW"

    return {
        "decision": decision,
        "category": category if decision == "BLOCK" else None,
        "scores": scores,
        "debug": {
            "rep_boost": rep_boost,
            "hc_boost": hc_boost,
            "tc_boost": tc_boost,
            "harassment_matches": h_matched,
            "threat_matches": t_matched,
            "sexual_matches": s_matched,
        }
    }


# ── Color helpers ─────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
GRAY   = "\033[90m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(s): return f"{GREEN}{s}{RESET}"
def err(s): return f"{RED}{s}{RESET}"
def warn(s): return f"{YELLOW}{s}{RESET}"
def info(s): return f"{CYAN}{s}{RESET}"
def dim(s): return f"{GRAY}{s}{RESET}"
def bold(s): return f"{BOLD}{s}{RESET}"


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CipherGate Policy Test Runner")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show score details for all cases")
    parser.add_argument("--filter", "-f", default=None,
                        help="Filter by expected category or decision (e.g. 'harassment', 'BLOCK', 'ALLOW', 'threat', 'sexual')")
    parser.add_argument("--fail-only", action="store_true", help="Only print failing cases")
    args = parser.parse_args()

    tuning    = json.loads(POLICY_FILE.read_text())
    thresholds = json.loads(THRESH_FILE.read_text())
    cases     = json.loads(CASES_FILE.read_text())

    if args.filter:
        flt = args.filter.upper()
        cases = [
            c for c in cases
            if flt in c["expected"].upper()
            or flt in c.get("expectedCategory", "").upper()
            or flt in c.get("id", "").upper()
        ]

    print(f"\n{bold('CipherGate Policy Test Runner')}")
    print(f"Policy:     {POLICY_FILE.name}")
    print(f"Thresholds: {json.dumps(thresholds['thresholds'])}")
    print(f"Cases:      {len(cases)}")
    print(f"{'─'*72}\n")

    passed = 0
    failed = 0
    failures = []

    for case in cases:
        cid      = case["id"]
        text     = case["text"]
        expected = case["expected"]
        exp_cat  = case.get("expectedCategory")
        note     = case.get("note", "")

        result   = evaluate(text, tuning, thresholds)
        decision = result["decision"]
        category = result["category"]
        scores   = result["scores"]
        dbg      = result["debug"]

        # Pass conditions
        decision_ok  = (decision == expected)
        category_ok  = (exp_cat is None or category == exp_cat) if decision == "BLOCK" else True
        all_ok = decision_ok and category_ok

        if all_ok:
            passed += 1
        else:
            failed += 1
            failures.append(case | {"result": result})

        # Display
        if args.fail_only and all_ok:
            continue

        status_icon = ok("✔ PASS") if all_ok else err("✘ FAIL")
        decision_str = (ok if decision == "ALLOW" else err)(decision)

        short_text = text[:56] + "…" if len(text) > 57 else text
        print(f"  {status_icon}  {bold(cid):<28} {decision_str}")
        print(f"          {dim(short_text)}")

        if not all_ok or args.verbose:
            score_line = (
                f"    harassment={scores['harassment']:.3f}  "
                f"threat={scores['threat']:.3f}  "
                f"sexual={scores['sexual']:.3f}"
            )
            print(warn(score_line) if not all_ok else dim(score_line))

            if not all_ok:
                exp_str = expected if exp_cat is None else f"{expected} [{exp_cat}]"
                got_str = decision if category is None else f"{decision} [{category}]"
                print(f"       {err('expected:')} {exp_str}   {err('got:')} {got_str}")

            if args.verbose or not all_ok:
                for cat, matches in [
                    ("harassment", dbg["harassment_matches"]),
                    ("threat",     dbg["threat_matches"]),
                    ("sexual",     dbg["sexual_matches"]),
                ]:
                    if matches:
                        print(f"       {info(cat)} matched: {matches}")
                if dbg["rep_boost"] or dbg["hc_boost"] or dbg["tc_boost"]:
                    print(f"       boosts: rep={dbg['rep_boost']:.2f} hc={dbg['hc_boost']:.2f} tc={dbg['tc_boost']:.2f}")

        print()

    # Summary
    total = passed + failed
    pct = 100 * passed // total if total else 0
    print(f"{'─'*72}")
    print(f"  {bold('Results:')}  {ok(str(passed))} passed  /  {err(str(failed)) if failed else dim('0')} failed  /  {total} total  →  {ok(str(pct)+'%') if pct >= 80 else warn(str(pct)+'%')}")

    if failures:
        print(f"\n  {bold(err('Failing cases:'))}")
        for f in failures:
            exp = f["expected"] if f.get("expectedCategory") is None else f"{f['expected']} [{f.get('expectedCategory')}]"
            got = f["result"]["decision"]
            cat = f["result"]["category"]
            got_str = got if cat is None else f"{got} [{cat}]"
            print(f"    {err('✘')} {f['id']:<30}  expected={exp:<22} got={got_str}")
    print()


if __name__ == "__main__":
    main()
