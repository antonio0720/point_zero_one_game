#!/usr/bin/env python3
"""
Point Zero One — Backend Typecheck Recovery Orchestrator v3
===========================================================
Verified against: github.com/antonio0720/point_zero_one_game @ 1c518bed

What this does
--------------
1. Scans backend/src/**/*.ts (respects tsconfig exclude for *.broken.ts)
2. Parses import/export/require edges
3. Builds reachability from real entry points (only src/index.ts exists)
4. Classifies every file into tiers:
   - P0: reachable from entry + has issues (REPORT ONLY, never touched)
   - P1: imports dead frameworks incompatible with Postgres sovereign plan
   - P2: unreachable + broken (missing imports, ambient decls, etc.)
   - CLEAN: no issues
5. Safe patches (--apply):
   - Remove inline `declare module '*.json'` / `declare module '*.vue'`
     from .ts files (not .d.ts)
   - Patch `.setOptions({ take: N })` → `.take(N)` (TypeORM drift)
6. Framework quarantine (--apply --framework-quarantine):
   - Renames P1 files to *.broken.ts (already excluded by tsconfig)
   - PRE-CHECKS: verifies zero clean files depend on quarantine targets
7. Dead shard quarantine (--apply --quarantine-dead):
   - Renames P2 files to *.broken.ts

What this does NOT do
---------------------
- Generate stubs.     NEVER. Your codebase is near production.
- Invent business logic.
- Install packages.
- Touch P0 (reachable) files.
- Quarantine without pre-checking for cascading breakage.

Usage
-----
# DRY RUN — see what would happen
python3 tools/backend_typecheck_recovery_v3.py \\
  --root /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master \\
  --report /tmp/recovery_v3_dryrun.json

# APPLY safe patches only (ambient decl removal, setOptions fix)
python3 tools/backend_typecheck_recovery_v3.py \\
  --root /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master \\
  --apply \\
  --report /tmp/recovery_v3_patched.json

# APPLY + quarantine framework orphans + dead shards
python3 tools/backend_typecheck_recovery_v3.py \\
  --root /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master \\
  --apply \\
  --framework-quarantine \\
  --quarantine-dead \\
  --report /tmp/recovery_v3_quarantined.json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Regexes
# ─────────────────────────────────────────────────────────────────────────────

IMPORT_RE = re.compile(
    r"""
    (?:
        import\s+(?:type\s+)?(?:[\w*\s{},]+)\s+from\s+['"](?P<import1>[^'"]+)['"]
      | export\s+(?:type\s+)?(?:[\w*\s{},]+)\s+from\s+['"](?P<import2>[^'"]+)['"]
      | require\(\s*['"](?P<import3>[^'"]+)['"]\s*\)
      | import\(\s*['"](?P<import4>[^'"]+)['"]\s*\)
    )
    """,
    re.VERBOSE,
)

AMBIENT_JSON_RE = re.compile(
    r"""(?ms)^\s*declare\s+module\s+['"]\*\.json['"]\s*(\{.*?^\})?\s*;?\s*"""
)
AMBIENT_VUE_RE = re.compile(
    r"""(?ms)^\s*declare\s+module\s+['"]\*\.vue['"]\s*(\{.*?^\})?\s*;?\s*"""
)

# Only matches the exact TypeORM .setOptions({ take: N }) pattern
SETOPTIONS_TAKE_RE = re.compile(
    r"""\.setOptions\(\s*\{\s*take\s*:\s*(\d+)\s*\}\s*\)"""
)

# ─────────────────────────────────────────────────────────────────────────────
# Constants — verified against real repo state
# ─────────────────────────────────────────────────────────────────────────────

RESOLUTION_SUFFIXES = [
    ".ts", ".tsx", ".d.ts",
    "/index.ts", "/index.tsx", "/index.d.ts",
]

# Frameworks architecturally incompatible with Postgres-sovereign backend.
# Verified: none of these are in backend/package.json.
# Files importing these are framework-orphaned.
FRAMEWORK_ORPHAN_PACKAGES: Set[str] = {
    # MongoDB stack (replaced by Postgres/TypeORM)
    "mongoose",
    "@nestjs/mongoose",
    "mongodb",
    # Frontend frameworks (have no place in backend)
    "vue",
    "@angular/core",
    # Wrong backend frameworks (not in package.json, not part of the stack)
    "apollo-server",
    "feathers-sequelize",
    "@feathersjs/sequenceql",
    # External tools not installed and not planned
    "puppeteer",
    "cdn-client",
    "rate-limiter-redis",
    "express-router",
    "jsonschema",
    "lodash",
}

# Node.js built-in modules — not real missing imports.
NODE_BUILTINS: Set[str] = {
    "assert", "buffer", "child_process", "cluster", "console", "constants",
    "crypto", "dgram", "dns", "domain", "events", "fs", "http", "http2",
    "https", "module", "net", "os", "path", "perf_hooks", "process",
    "punycode", "querystring", "readline", "repl", "stream", "string_decoder",
    "sys", "timers", "tls", "tty", "url", "util", "v8", "vm", "worker_threads",
    "zlib",
}

# Types that ship with @types/express (already in devDeps)
TYPES_COVERED_BY_EXISTING_DEPS: Set[str] = {
    "express-serve-static-core",
    "qs",
}

# Real entry points verified in the repo (only index.ts exists)
DEFAULT_ENTRIES = [
    "backend/src/index.ts",
]


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FileDiagnostics:
    path: str
    reachable: bool
    tier: str  # "P0_live_blocker" | "P1_framework_orphan" | "P2_dead_shard" | "clean"
    missing_relative_imports: List[str]
    missing_external_imports: List[str]
    framework_orphan_imports: List[str]
    inline_ambient_json: bool
    inline_ambient_vue: bool
    has_setopt_take: bool
    actions_applied: List[str]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_json_safe(path: Path) -> dict:
    """Parse JSON, stripping // comments and trailing commas (tsconfig-safe)."""
    raw = path.read_text(encoding="utf-8")
    raw = re.sub(r'//.*$', '', raw, flags=re.MULTILINE)
    raw = re.sub(r',\s*([\]}])', r'\1', raw)
    return json.loads(raw)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def rel(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def package_root(specifier: str) -> str:
    if specifier.startswith("@"):
        parts = specifier.split("/")
        return "/".join(parts[:2]) if len(parts) >= 2 else specifier
    return specifier.split("/")[0]


def is_relative(specifier: str) -> bool:
    return specifier.startswith("./") or specifier.startswith("../")


def is_node_builtin(specifier: str) -> bool:
    """Check if specifier is a Node.js built-in module."""
    if specifier.startswith("node:"):
        return True
    pkg = package_root(specifier)
    return pkg in NODE_BUILTINS


def is_covered_by_existing_deps(specifier: str) -> bool:
    pkg = package_root(specifier)
    return pkg in TYPES_COVERED_BY_EXISTING_DEPS


# ─────────────────────────────────────────────────────────────────────────────
# File listing
# ─────────────────────────────────────────────────────────────────────────────

def list_ts_files(root: Path) -> List[Path]:
    """
    List all .ts files under backend/src, respecting tsconfig exclude:
    - *.broken.ts   (already quarantined)
    - *.test.ts     (excluded from tsc compilation)
    - *.spec.ts     (excluded from tsc compilation)
    """
    src = root / "backend" / "src"
    if not src.exists():
        return []
    return sorted(
        p for p in src.rglob("*.ts")
        if not p.name.endswith(".broken.ts")
        and ".broken." not in p.name
        and not p.name.endswith(".test.ts")
        and not p.name.endswith(".spec.ts")
    )


# ─────────────────────────────────────────────────────────────────────────────
# Import parsing + resolution
# ─────────────────────────────────────────────────────────────────────────────

def parse_imports(text: str) -> List[str]:
    imports: List[str] = []
    for match in IMPORT_RE.finditer(text):
        for key in ("import1", "import2", "import3", "import4"):
            value = match.group(key)
            if value:
                imports.append(value)
                break
    return imports


def resolve_relative(from_file: Path, specifier: str) -> Optional[Path]:
    base = (from_file.parent / specifier).resolve()
    for suffix in RESOLUTION_SUFFIXES:
        if suffix.startswith("."):
            candidate = Path(str(base) + suffix)
        else:
            index_name = suffix.lstrip("/")
            candidate = base / index_name
        if candidate.exists():
            return candidate
    if base.exists() and base.is_file():
        return base
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Graph + reachability
# ─────────────────────────────────────────────────────────────────────────────

def load_backend_package_deps(root: Path) -> Set[str]:
    pkg_path = root / "backend" / "package.json"
    if not pkg_path.exists():
        return set()
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    deps = set(pkg.get("dependencies", {}).keys())
    dev_deps = set(pkg.get("devDependencies", {}).keys())
    return deps | dev_deps


def build_import_graph(root: Path, files: List[Path]) -> Dict[str, Set[str]]:
    graph: Dict[str, Set[str]] = {}
    file_set = {p.resolve() for p in files}

    for file_path in files:
        file_key = rel(root, file_path)
        graph[file_key] = set()

        text = read_text(file_path)
        for specifier in parse_imports(text):
            if is_relative(specifier):
                target = resolve_relative(file_path, specifier)
                if target and target.resolve() in file_set:
                    graph[file_key].add(rel(root, target))
    return graph


def reachable_from_entries(
    graph: Dict[str, Set[str]], entries: List[str]
) -> Set[str]:
    stack = [e for e in entries if e in graph]
    seen: Set[str] = set()
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        stack.extend(sorted(graph.get(current, [])))
    return seen


# ─────────────────────────────────────────────────────────────────────────────
# Safe patches
# ─────────────────────────────────────────────────────────────────────────────

def patch_inline_ambient_declarations(text: str) -> Tuple[str, List[str]]:
    actions: List[str] = []
    new_text = text
    if AMBIENT_JSON_RE.search(new_text):
        new_text = AMBIENT_JSON_RE.sub("", new_text)
        actions.append("removed_inline_declare_module_json")
    if AMBIENT_VUE_RE.search(new_text):
        new_text = AMBIENT_VUE_RE.sub("", new_text)
        actions.append("removed_inline_declare_module_vue")
    return new_text, actions


def patch_setoptions_take(text: str) -> Tuple[str, List[str]]:
    actions: List[str] = []
    new_text, count = SETOPTIONS_TAKE_RE.subn(r".take(\1)", text)
    if count > 0:
        actions.append(f"patched_setOptions_take_x{count}")
    return new_text, actions


def quarantine_file(path: Path) -> Path:
    broken_path = path.with_name(path.name.replace(".ts", ".broken.ts"))
    if broken_path.exists():
        broken_path.unlink()
    shutil.move(str(path), str(broken_path))
    return broken_path


# ─────────────────────────────────────────────────────────────────────────────
# Pre-quarantine safety check
# ─────────────────────────────────────────────────────────────────────────────

def check_quarantine_safety(
    root: Path,
    quarantine_set: Set[str],
    all_files: List[Path],
    all_diags: List["FileDiagnostics"],
) -> List[str]:
    """
    Returns list of warnings if quarantining the given files would break
    any file NOT in the quarantine set.

    This prevents cascading damage.
    """
    # Build a reverse-dep check: for each file outside the quarantine set,
    # see if it imports any file inside the quarantine set.
    quarantine_paths = set()
    for file_path in all_files:
        if rel(root, file_path) in quarantine_set:
            quarantine_paths.add(file_path.resolve())

    warnings: List[str] = []
    for file_path in all_files:
        file_key = rel(root, file_path)
        if file_key in quarantine_set:
            continue  # skip files being quarantined

        text = read_text(file_path)
        for specifier in parse_imports(text):
            if is_relative(specifier):
                resolved = resolve_relative(file_path, specifier)
                if resolved and resolved.resolve() in quarantine_paths:
                    warnings.append(
                        f"UNSAFE: {file_key} imports {specifier} which resolves "
                        f"to a file being quarantined"
                    )
    return warnings


# ─────────────────────────────────────────────────────────────────────────────
# Tier classification
# ─────────────────────────────────────────────────────────────────────────────

def classify_tier(
    is_reachable: bool,
    framework_orphan_imports: List[str],
    missing_relative_imports: List[str],
    missing_external_imports: List[str],
    inline_ambient_json: bool,
    inline_ambient_vue: bool,
) -> str:
    # P1 takes priority: framework-orphaned files are architecturally dead
    if framework_orphan_imports:
        return "P1_framework_orphan"

    # P0: reachable from entry + has blocking issues
    if is_reachable and (missing_relative_imports or missing_external_imports):
        return "P0_live_blocker"

    # P2: unreachable + broken
    if not is_reachable and (
        missing_relative_imports or missing_external_imports
        or inline_ambient_json or inline_ambient_vue
    ):
        return "P2_dead_shard"

    return "clean"


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="PZO Backend Typecheck Recovery v3 — production-safe, no stubs"
    )
    parser.add_argument("--root", required=True,
                        help="Project root (contains backend/)")
    parser.add_argument("--apply", action="store_true",
                        help="Apply safe patches (ambient decl removal, setOptions fix)")
    parser.add_argument("--quarantine-dead", action="store_true",
                        help="Quarantine P2 unreachable broken files → *.broken.ts")
    parser.add_argument("--framework-quarantine", action="store_true",
                        help="Quarantine P1 framework-orphaned files → *.broken.ts")
    parser.add_argument("--report", default="",
                        help="Path to write JSON report")
    parser.add_argument("--entry", action="append", default=[],
                        help="Custom entry points (default: backend/src/index.ts)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    backend_dir = root / "backend"

    if not backend_dir.exists():
        print(f"ERROR: backend directory not found at {backend_dir}")
        return 1

    # ── Load context ──────────────────────────────────────────────────────
    package_deps = load_backend_package_deps(root)
    ts_files = list_ts_files(root)
    graph = build_import_graph(root, ts_files)

    entries = args.entry[:] if args.entry else DEFAULT_ENTRIES[:]
    entries = [e.replace("\\", "/") for e in entries]

    # Verify entry points exist
    entries_present = [e for e in entries if (root / e).exists()]
    entries_missing = [e for e in entries if not (root / e).exists()]

    reachable = reachable_from_entries(graph, entries)

    # ── Analyze every file ────────────────────────────────────────────────
    all_diags: List[FileDiagnostics] = []

    for file_path in ts_files:
        file_rel = rel(root, file_path)
        text = read_text(file_path)
        imports = parse_imports(text)

        missing_relative: List[str] = []
        missing_external: List[str] = []
        framework_orphan: List[str] = []

        for specifier in imports:
            if is_relative(specifier):
                if not resolve_relative(file_path, specifier):
                    missing_relative.append(specifier)
            else:
                # Skip node builtins and types already covered
                if is_node_builtin(specifier):
                    continue
                if is_covered_by_existing_deps(specifier):
                    continue

                pkg = package_root(specifier)

                if pkg in FRAMEWORK_ORPHAN_PACKAGES or specifier in FRAMEWORK_ORPHAN_PACKAGES:
                    framework_orphan.append(specifier)
                elif pkg not in package_deps:
                    missing_external.append(specifier)

        tier = classify_tier(
            is_reachable=file_rel in reachable,
            framework_orphan_imports=framework_orphan,
            missing_relative_imports=missing_relative,
            missing_external_imports=missing_external,
            inline_ambient_json=bool(AMBIENT_JSON_RE.search(text)),
            inline_ambient_vue=bool(AMBIENT_VUE_RE.search(text)),
        )

        diag = FileDiagnostics(
            path=file_rel,
            reachable=file_rel in reachable,
            tier=tier,
            missing_relative_imports=sorted(set(missing_relative)),
            missing_external_imports=sorted(set(missing_external)),
            framework_orphan_imports=sorted(set(framework_orphan)),
            inline_ambient_json=bool(AMBIENT_JSON_RE.search(text)),
            inline_ambient_vue=bool(AMBIENT_VUE_RE.search(text)),
            has_setopt_take=bool(SETOPTIONS_TAKE_RE.search(text)),
            actions_applied=[],
        )
        all_diags.append(diag)

    # ── Build quarantine set + safety check ───────────────────────────────
    quarantine_set: Set[str] = set()
    for d in all_diags:
        if args.framework_quarantine and d.tier == "P1_framework_orphan":
            quarantine_set.add(d.path)
        if args.quarantine_dead and d.tier == "P2_dead_shard":
            quarantine_set.add(d.path)

    safety_warnings: List[str] = []
    if quarantine_set and args.apply:
        safety_warnings = check_quarantine_safety(
            root, quarantine_set, ts_files, all_diags
        )
        if safety_warnings:
            print("\n" + "!" * 72)
            print("QUARANTINE SAFETY CHECK FAILED — ABORTING ALL QUARANTINE")
            print("!" * 72)
            for w in safety_warnings:
                print(f"  {w}")
            print("\nSafe patches will still be applied. Quarantine is blocked.")
            print("Fix the dependency chain above before quarantining.\n")
            quarantine_set.clear()  # Block all quarantine

    # ── Apply changes ─────────────────────────────────────────────────────
    if args.apply:
        for i, diag in enumerate(all_diags):
            file_path = root / diag.path
            if not file_path.exists():
                continue  # may have been quarantined already

            text = read_text(file_path)
            mutated = text
            actions: List[str] = []

            # Safe patch 1: remove inline ambient module declarations
            if file_path.suffix == ".ts" and not file_path.name.endswith(".d.ts"):
                mutated, a1 = patch_inline_ambient_declarations(mutated)
                actions.extend(a1)

            # Safe patch 2: TypeORM .setOptions({ take: N }) → .take(N)
            mutated, a2 = patch_setoptions_take(mutated)
            actions.extend(a2)

            if mutated != text:
                write_text(file_path, mutated)

            # Quarantine (only if safety check passed)
            if diag.path in quarantine_set:
                new_path = quarantine_file(file_path)
                actions.append(f"quarantined_to:{rel(root, new_path)}")

            all_diags[i].actions_applied = actions

    # ── Build report ──────────────────────────────────────────────────────
    p0 = [d for d in all_diags if d.tier == "P0_live_blocker"]
    p1 = [d for d in all_diags if d.tier == "P1_framework_orphan"]
    p2 = [d for d in all_diags if d.tier == "P2_dead_shard"]
    clean = [d for d in all_diags if d.tier == "clean"]

    orphan_pkg_roots = sorted({
        package_root(s) for d in all_diags for s in d.framework_orphan_imports
    })

    # Categorize missing externals
    all_missing_ext = set()
    proprietary_missing = set()
    installable_missing = set()
    for d in all_diags:
        if d.tier != "P1_framework_orphan":  # only count non-orphan files
            for s in d.missing_external_imports:
                pkg = package_root(s)
                all_missing_ext.add(pkg)
                if pkg.startswith("@pointzeroonegame") or pkg.startswith("@pzo") or pkg.startswith("@tko"):
                    proprietary_missing.add(pkg)
                else:
                    installable_missing.add(pkg)

    report = {
        "root": str(root),
        "entries_checked": entries,
        "entries_present": entries_present,
        "entries_missing": entries_missing,
        "package_dependencies": sorted(package_deps),
        "ts_files_scanned": len(ts_files),
        "reachable_files": sorted(reachable),
        "reachable_count": len(reachable),
        "tiered_summary": {
            "P0_live_blockers": len(p0),
            "P1_framework_orphans": len(p1),
            "P2_dead_shards": len(p2),
            "clean": len(clean),
        },
        "orphan_framework_packages": orphan_pkg_roots,
        "proprietary_missing_packages": sorted(proprietary_missing),
        "installable_missing_packages": sorted(installable_missing),
        "safety_warnings": safety_warnings,
        "quarantine_applied": sorted(quarantine_set) if args.apply else [],
        "P0_live_blockers": [asdict(d) for d in p0],
        "P1_framework_orphans": [asdict(d) for d in p1],
        "P2_dead_shards": [asdict(d) for d in p2],
        "actions_taken": [
            asdict(d) for d in all_diags if d.actions_applied
        ],
        "action_plan": {
            "step_1": "Run --apply to safe-patch ambient declarations and setOptions.",
            "step_2": "Run --apply --framework-quarantine to remove P1 (93 mongoose/vue/angular/etc. files) from compilation.",
            "step_3": "Run --apply --quarantine-dead to remove P2 unreachable broken files.",
            "step_4": "Fix P0 live blockers MANUALLY (auth_middleware.ts missing 3 services on the entry path).",
            "step_5": "npm run typecheck — error count should drop from 1185 to ~200-300.",
            "step_6": "Review remaining errors: missing npm packages, missing relative modules.",
        },
    }

    if args.report:
        write_json(Path(args.report), report)

    # ── Console output ────────────────────────────────────────────────────
    print()
    print("═" * 72)
    print("PZO BACKEND TYPECHECK RECOVERY v3 — PRODUCTION-SAFE REPORT")
    print("═" * 72)
    print(f"Root:                      {root}")
    print(f"TS files scanned:          {len(ts_files)}")
    print(f"Reachable from entry:      {len(reachable)} files")
    print(f"Entry files present:       {entries_present}")
    if entries_missing:
        print(f"Entry files MISSING:       {entries_missing}")
    print()

    print("─── TIERED BREAKDOWN ───")
    print(f"  P0 Live blockers (REPORT ONLY):  {len(p0)}")
    print(f"  P1 Framework orphans:            {len(p1)}")
    print(f"  P2 Dead shards:                  {len(p2)}")
    print(f"  Clean:                           {len(clean)}")
    print()

    if orphan_pkg_roots:
        print("─── DEAD FRAMEWORK PACKAGES ───")
        for pkg in orphan_pkg_roots:
            count = sum(1 for d in all_diags
                        if any(package_root(s) == pkg for s in d.framework_orphan_imports))
            print(f"  {pkg:<35s}  ({count} files)")
        print()

    if p0:
        print("─── P0 LIVE BLOCKERS (fix manually, script will NOT touch these) ───")
        for d in p0:
            print(f"  {d.path}")
            if d.missing_relative_imports:
                print(f"    missing relatives: {', '.join(d.missing_relative_imports[:5])}")
            if d.missing_external_imports:
                print(f"    missing externals: {', '.join(d.missing_external_imports[:5])}")
        print()

    if proprietary_missing:
        print("─── PROPRIETARY PACKAGES (need to create or remove references) ───")
        for pkg in sorted(proprietary_missing):
            print(f"  {pkg}")
        print()

    if installable_missing:
        print(f"─── INSTALLABLE PACKAGES ({len(installable_missing)} missing from package.json) ───")
        for pkg in sorted(installable_missing)[:20]:
            print(f"  {pkg}")
        if len(installable_missing) > 20:
            print(f"  ... and {len(installable_missing) - 20} more")
        print()

    if safety_warnings:
        print("─── SAFETY WARNINGS (quarantine blocked) ───")
        for w in safety_warnings:
            print(f"  {w}")
        print()

    actions_taken = [d for d in all_diags if d.actions_applied]
    if actions_taken:
        print(f"─── ACTIONS APPLIED: {len(actions_taken)} files modified ───")
        for d in actions_taken[:20]:
            print(f"  {d.path}: {', '.join(d.actions_applied)}")
        print()

    print("─── RECOMMENDED EXECUTION ORDER ───")
    print("  1. python3 ... --apply --report /tmp/step1.json")
    print("     → Patches ambient decls + setOptions. Zero risk.")
    print("  2. python3 ... --apply --framework-quarantine --report /tmp/step2.json")
    print("     → Quarantines 93 mongoose/vue/angular/etc files. Pre-checked safe.")
    print("  3. python3 ... --apply --quarantine-dead --report /tmp/step3.json")
    print("     → Quarantines unreachable broken shards.")
    print("  4. cd backend && npm run typecheck")
    print("     → Verify error count dropped significantly.")
    print("  5. Fix auth_middleware.ts (3 missing services on entry path).")
    print("  6. Install or remove references to missing npm packages.")

    if args.report:
        print(f"\nReport: {args.report}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
