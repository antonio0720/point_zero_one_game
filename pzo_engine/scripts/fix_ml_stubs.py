#!/usr/bin/env python3
"""
Fix all 148 ML stub files so they:
1. Don't throw in fallback (return neutral degraded output)
2. Don't throw in main function (delegate to fallback)
3. Add createHash import for audit hash computation

Skips M01A and M02A (already fully implemented).
"""

import os
import re
import glob

ML_DIR = "/home/claude/point_zero_one_game/pzo_engine/src/ml"
SKIP = {"m01a_", "m02a_"}

def extract_ml_id(filename: str) -> str:
    """Extract ML ID like 'M04A' from filename like 'm04a_...'"""
    match = re.match(r"(m\d+a)_", os.path.basename(filename))
    if not match:
        return ""
    return match.group(1).upper()

def extract_extended_fields(content: str, ml_id: str) -> list[tuple[str, str]]:
    """Extract extended output fields (name, type) from the MxxAOutput interface."""
    # Pattern: export interface MxxAOutput extends MxxABaseOutput { ... }
    pattern = rf"export interface {ml_id}Output extends {ml_id}BaseOutput \{{(.*?)\}}"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return []
    body = match.group(1)
    fields = []
    for line in body.strip().split("\n"):
        line = line.strip()
        if line.startswith("//") or not line:
            continue
        # Match: fieldName: type; // comment
        field_match = re.match(r"(\w+):\s*([^;]+);", line)
        if field_match:
            fields.append((field_match.group(1).strip(), field_match.group(2).strip()))
    return fields

def build_fallback_body(ml_id: str, fields: list[tuple[str, str]], constants_name: str) -> str:
    """Build the non-throwing fallback function body."""
    # Build the extended field defaults
    field_defaults = []
    for name, typ in fields:
        if typ == "unknown":
            field_defaults.append(f"    {name}: null,")
        elif typ == "number":
            field_defaults.append(f"    {name}: 0,")
        elif typ == "string":
            field_defaults.append(f"    {name}: '',")
        elif typ == "boolean":
            field_defaults.append(f"    {name}: false,")
        elif "[]" in typ:
            field_defaults.append(f"    {name}: [],")
        else:
            field_defaults.append(f"    {name}: null,")

    fields_str = "\n".join(field_defaults) if field_defaults else ""

    return f"""  const seed = String((_input as Record<string, unknown>).runSeed ?? '');
  const tick = Number((_input as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:{ml_id}')
    .digest('hex');
  return {{
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
{fields_str}
  }};"""

def fix_file(filepath: str) -> bool:
    """Fix a single ML stub file. Returns True if modified."""
    with open(filepath, "r") as f:
        content = f.read()

    # Skip if no throws
    if "throw new Error" not in content:
        return False

    ml_id = extract_ml_id(filepath)
    if not ml_id:
        print(f"  SKIP: could not extract ML ID from {filepath}")
        return False

    lower_id = ml_id.lower()  # e.g. "m04a"
    constants_name = f"{ml_id}_ML_CONSTANTS"

    # Extract extended fields
    fields = extract_extended_fields(content, ml_id)

    modified = False

    # 1. Add createHash import if not present
    if "import { createHash }" not in content and "from 'node:crypto'" not in content:
        # Insert after the header comment block
        # Find the end of the header (after "// ═══...═══")
        header_end = content.rfind("// ═══════════════════════════════════════════════════════════════════════════════\n")
        if header_end >= 0:
            insert_pos = content.index("\n", header_end) + 1
            content = content[:insert_pos] + "\nimport { createHash } from 'node:crypto';\n" + content[insert_pos:]
            modified = True

    # 2. Fix the fallback function - replace throw with working body
    fallback_func_name = f"run{ml_id[0]}{lower_id[1:]}MlFallback"
    # Pattern: everything from the function body opening brace to the throw + closing brace
    fallback_pattern = re.compile(
        rf"(export function {fallback_func_name}\(\s*_input:.*?\):\s*{ml_id}Output\s*\{{)\s*\n"
        rf".*?throw new Error\(.*?\);\s*\n\}}",
        re.DOTALL
    )
    
    fallback_body = build_fallback_body(ml_id, fields, constants_name)
    fallback_match = fallback_pattern.search(content)
    if fallback_match:
        replacement = fallback_match.group(1) + "\n" + fallback_body + "\n}"
        content = content[:fallback_match.start()] + replacement + content[fallback_match.end():]
        modified = True

    # 3. Fix the main function - replace throw with delegation to fallback
    main_func_name = f"run{ml_id[0]}{lower_id[1:]}Ml"
    # Pattern: from the function body { ... throw ... }
    main_pattern = re.compile(
        rf"(export async function {main_func_name}\(\s*"
        rf"input:\s*{ml_id}TelemetryInput,\s*"
        rf"tier:\s*{ml_id}Tier\s*=\s*'baseline',\s*"
        rf"modelCard:\s*Omit<{ml_id}ModelCard,\s*'modelId'\s*\|\s*'coreMechanicPair'>,\s*"
        rf"\):\s*Promise<{ml_id}Output>\s*\{{)\s*\n"
        rf".*?throw new Error\(.*?\);\s*\n\}}",
        re.DOTALL
    )

    main_match = main_pattern.search(content)
    if main_match:
        main_replacement = (
            main_match.group(1) + "\n"
            f"  // Day-1 operational: delegates to fallback until full ML implementation is deployed.\n"
            f"  // Full implementation checklist preserved in git history.\n"
            f"  return {fallback_func_name}(input);\n"
            f"}}"
        )
        content = content[:main_match.start()] + main_replacement + content[main_match.end():]
        modified = True

    if modified:
        with open(filepath, "w") as f:
            f.write(content)

    return modified


def main():
    files = sorted(glob.glob(os.path.join(ML_DIR, "m*a_*.ts")))
    # Exclude runtime directory files
    files = [f for f in files if "/runtime/" not in f]
    
    fixed = 0
    skipped = 0
    errors = 0

    for filepath in files:
        basename = os.path.basename(filepath)
        # Skip already-implemented files
        if any(basename.startswith(skip) for skip in SKIP):
            skipped += 1
            continue
        
        try:
            if fix_file(filepath):
                fixed += 1
                print(f"  FIXED: {basename}")
            else:
                print(f"  NO-OP: {basename} (no throws found)")
        except Exception as e:
            errors += 1
            print(f"  ERROR: {basename}: {e}")

    print(f"\n{'='*60}")
    print(f"Total files: {len(files)}")
    print(f"Fixed: {fixed}")
    print(f"Skipped (implemented): {skipped}")
    print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
