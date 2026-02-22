#!/usr/bin/env python3
"""
PZO ANSI ESCAPE STRIPPER v2
Strips Ollama streaming terminal escape sequences + Braille spinners from all generated files.
Extracts clean TypeScript/TSX code from markdown code fence wrappers.

Usage:
  python3 strip_ansi_pzo.py [path_to_pzo_complete_automation]
  python3 strip_ansi_pzo.py [path] --dry-run   # preview only, no changes

Default path: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation
"""

import re
import sys
import time
from pathlib import Path

ANSI_ESCAPE = re.compile(
    r'\x1b(?:\[\?2026[hl]|\[\?25[lh]|\[1G|\[2K|\[K|\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07|[A-Za-z])'
    r'|\r',
    re.MULTILINE
)

BRAILLE_INLINE = re.compile(r'[\u2800-\u28FF][\u2800-\u28FF \t]+')
BRAILLE_SPINNER_BLOCK = re.compile(r'^[\u2800-\u28FF ]+\n?', re.MULTILINE)

PREAMBLE = re.compile(
    r"^(?:I(?:'m| am) an? (?:AI |language )?(?:assistant|model|language model).*?\n+"
    r"|Here(?:'s| is) (?:a |an |the )?(?:simplified |basic |example )?.*?:\s*\n+"
    r"|This (?:is|provides|implements|represents|includes).*?\n+"
    r"|Below (?:is|are).*?:\s*\n+"
    r"|The following.*?:\s*\n+"
    r"|Please note.*?\n+"
    r")+",
    re.MULTILINE | re.IGNORECASE | re.DOTALL
)

CODE_FENCE_EXTRACT = re.compile(
    r'```(?:typescript|javascript|tsx?|jsx?|bash|sh|python|py|json|yaml|yml|markdown|md)?\s*\n'
    r'(.*?)'
    r'\n```(?:\s*)$',
    re.DOTALL | re.MULTILINE
)

TARGET_EXTENSIONS = {'.ts', '.tsx', '.md', '.sh', '.py', '.json', '.yaml', '.yml'}


def clean_file_content(content: str, ext: str) -> str:
    out = ANSI_ESCAPE.sub('', content)
    out = BRAILLE_INLINE.sub('', out)
    out = BRAILLE_SPINNER_BLOCK.sub('', out)
    out = PREAMBLE.sub('', out)

    if ext in ('.ts', '.tsx', '.js', '.jsx', '.sh', '.py'):
        fences = CODE_FENCE_EXTRACT.findall(out)
        if fences:
            largest = max(fences, key=len)
            if len(largest) >= len(out.strip()) * 0.5:
                out = largest

    out = re.sub(r'\n{4,}', '\n\n\n', out)
    out = out.strip()
    if out:
        out += '\n'
    return out


def has_contamination(content: str) -> bool:
    return (
        '\x1b' in content
        or '\r' in content
        or any('\u2800' <= c <= '\u28FF' for c in content[:200])
    )


def process_file(filepath: Path, dry_run: bool = False) -> tuple:
    try:
        raw = filepath.read_bytes()
        try:
            content = raw.decode('utf-8')
        except UnicodeDecodeError:
            content = raw.decode('latin-1')

        if not has_contamination(content):
            return False, 'clean'

        cleaned = clean_file_content(content, filepath.suffix)

        if not cleaned.strip():
            return False, 'empty_after_strip'

        if not dry_run:
            filepath.write_text(cleaned, encoding='utf-8')

        return True, 'fixed'

    except PermissionError:
        return False, 'error:permission_denied'
    except Exception as e:
        return False, f'error:{type(e).__name__}:{e}'


def main():
    base_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        '/Users/mervinlarry/workspaces/adam/Projects/adam/'
        'point_zero_one_master/pzo_complete_automation'
    )
    dry_run = '--dry-run' in sys.argv

    if not base_path.exists():
        print(f'ERROR: Path not found: {base_path}')
        sys.exit(1)

    print(f'PZO ANSI ESCAPE STRIPPER v2')
    print(f'Target : {base_path}')
    print(f'Mode   : {"DRY RUN -- no files modified" if dry_run else "LIVE -- files will be overwritten"}')
    print('-' * 60)

    if not dry_run:
        confirm = input('This will overwrite 25,000+ files. Continue? [y/N]: ').strip().lower()
        if confirm != 'y':
            print('Aborted.')
            sys.exit(0)

    all_files = [
        f for f in base_path.rglob('*')
        if f.is_file() and f.suffix in TARGET_EXTENSIONS and '.git' not in f.parts
    ]

    total = len(all_files)
    print(f'Files  : {total:,} to process\n')

    stats = {'fixed': 0, 'clean': 0, 'empty': 0, 'error': 0}
    errors = []
    start = time.time()

    for i, fp in enumerate(all_files, 1):
        modified, status = process_file(fp, dry_run=dry_run)

        if status == 'fixed':       stats['fixed'] += 1
        elif status == 'clean':     stats['clean'] += 1
        elif 'empty' in status:     stats['empty'] += 1
        else:                       stats['error'] += 1; errors.append((str(fp.relative_to(base_path)), status))

        if i % 1000 == 0 or i == total:
            elapsed = time.time() - start
            rate = i / max(elapsed, 0.001)
            eta = (total - i) / rate
            print(f'  [{i:>7,}/{total:,}]  Fixed: {stats["fixed"]:,}  Clean: {stats["clean"]:,}  Errors: {stats["error"]}  ETA: {eta:.0f}s')

    elapsed = time.time() - start
    print('\n' + '-' * 60)
    print(f'DONE in {elapsed:.1f}s')
    print(f'  Fixed (ANSI stripped + code extracted) : {stats["fixed"]:>8,}')
    print(f'  Already clean                          : {stats["clean"]:>8,}')
    print(f'  Empty after strip                      : {stats["empty"]:>8,}')
    print(f'  Errors                                 : {stats["error"]:>8,}')

    if errors:
        print(f'\nERRORS:')
        for path, err in errors[:20]:
            print(f'  {path}: {err}')

    if not dry_run and stats['fixed'] > 0:
        print(f'\n{stats["fixed"]:,} files are now clean TypeScript/TSX.')
        print('Next: run `tsc --noEmit` to verify compilation.')
    elif dry_run:
        print(f'\nDRY RUN complete. Re-run without --dry-run to apply.')


if __name__ == '__main__':
    main()
