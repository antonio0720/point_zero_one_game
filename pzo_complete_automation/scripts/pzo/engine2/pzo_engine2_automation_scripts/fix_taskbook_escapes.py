#!/usr/bin/env python3
"""
fix_taskbook_escapes.py — Repairs invalid JSON escape sequences in an NDJSON taskbook.

Usage:
    python3 fix_taskbook_escapes.py <input.ndjson> <output.ndjson>

Example:
    python3 fix_taskbook_escapes.py pzo_engine2_pressure_taskbook_v4.ndjson pzo_engine2_pressure_taskbook_v4_fixed.ndjson
"""

import sys
import json

VALID_ESCAPES = set('"\\\/bfnrtu')


def fix_escapes(s: str) -> str:
    """Double any backslash not followed by a valid JSON escape character."""
    result = []
    i = 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            next_char = s[i + 1]
            if next_char in VALID_ESCAPES:
                result.append(s[i])
                result.append(next_char)
                i += 2
            else:
                result.append('\\\\')
                i += 1
        else:
            result.append(s[i])
            i += 1
    return ''.join(result)


def repair_line(raw: str):
    """Try to parse; if fail, attempt escape repair then retry.
    Returns (obj_or_None, status_string)
    """
    try:
        return json.loads(raw), "ok"
    except json.JSONDecodeError:
        pass

    repaired = fix_escapes(raw)
    try:
        return json.loads(repaired), "repaired"
    except json.JSONDecodeError as e:
        return None, f"unfixable: {e}"


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 fix_taskbook_escapes.py <input.ndjson> <output.ndjson>")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]

    ok = repaired = failed = 0
    out_lines = []

    with open(src, encoding='utf-8') as f:
        lines = f.readlines()

    for i, raw in enumerate(lines, 1):
        stripped = raw.strip()
        if not stripped:
            out_lines.append('')
            continue

        obj, status = repair_line(stripped)

        if obj is None:
            print(f"  UNFIXABLE line {i}: {status}")
            failed += 1
            out_lines.append(stripped)
        elif status == "repaired":
            print(f"  REPAIRED line {i}: {obj.get('task_id', '?')}")
            repaired += 1
            out_lines.append(json.dumps(obj, ensure_ascii=False))
        else:
            ok += 1
            out_lines.append(json.dumps(obj, ensure_ascii=False))

    with open(dst, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out_lines) + '\n')

    print(f"\nResult: {ok} ok  {repaired} repaired  {failed} unfixable")
    print(f"Output: {dst}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
