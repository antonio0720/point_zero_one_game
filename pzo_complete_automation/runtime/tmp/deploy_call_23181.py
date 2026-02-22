import json, urllib.request, sys, os

host  = os.environ.get('OLLAMA_HOST',  'http://localhost:11434')
model = os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')

task_type = """create_docs"""
out_path  = """docs/pzo/architecture/POINT_ZERO_ONE_BACKEND_TREE_FULL.md"""
spec      = """Copy of backend tree (source: POINT_ZERO_ONE_BACKEND_TREE_FULL.md)"""
ext       = """md"""

lang_map = {
    'ts':  'TypeScript', 'tsx': 'TypeScript React', 'sh':  'Bash',
    'md':  'Markdown',   'py':  'Python',           'sql': 'SQL',
    'yaml':'YAML',       'yml': 'YAML',             'json':'JSON',
    'proto':'Protobuf',  'js':  'JavaScript',       'tf':  'Terraform HCL',
}
lang = lang_map.get(ext, 'text')

GAME_CONTEXT = """
Point Zero One Digital: a 12-minute financial roguelike game.
Sovereign infrastructure architect design. Production-grade, deployment-ready.
Never use 'any' in TypeScript. All code is strict-mode. All effects are deterministic.
"""

if task_type in ('create_module', 'implement_feature', 'create_contract', 'create_migration', 'create_job'):
    prompt = f"""You are a senior {lang} engineer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete file contents. No markdown fences. No explanations. No preamble.
- TypeScript: strict types, no 'any', export all public symbols, include JSDoc
- SQL: include indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
- Bash: set -euo pipefail, log all actions
- YAML/JSON/Terraform: production-ready with all required fields
- Preserve determinism where the spec involves game engine or replay

Output the complete {ext} file now:"""

elif task_type in ('create_tests', 'create_test'):
    prompt = f"""You are a senior test engineer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete test file. No markdown fences. No preamble.
- TypeScript tests: import {{ describe, it, expect, beforeEach, afterEach }} from 'vitest'
- All tests must be deterministic (no random seeds unless seeded)
- Cover happy path, edge cases, and boundary conditions

Output the complete test file now:"""

elif task_type == 'create_docs':
    prompt = f"""You are a technical writer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete markdown document. No preamble.
- Use precise, execution-grade language. Zero fluff. Anti-bureaucratic.
- Include: overview, non-negotiables, implementation spec, edge cases where relevant.

Output the complete markdown document now:"""

elif task_type == 'create_ops':
    prompt = f"""You are a senior DevOps/SRE engineer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete file contents. No markdown fences. No preamble.
- YAML: valid schema, all required fields, comments on non-obvious config
- Shell: idempotent, has rollback notes, logs to structured output
- Grafana JSON: complete valid dashboard JSON

Output the complete {ext} file now:"""

else:
    prompt = f"Generate complete file for Point Zero One Digital.\nFile: {out_path}\nSpec: {spec}\nOutput the complete file:"

payload = json.dumps({
    'model': model,
    'prompt': prompt,
    'stream': False,
    'options': {'temperature': 0.05, 'num_predict': 4096, 'top_p': 0.9}
}).encode('utf-8')

req = urllib.request.Request(
    f'{host}/api/generate',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=240) as resp:
        data = json.loads(resp.read())
        text = data.get('response', '').strip()
        # Strip markdown fences
        lines = text.split('\n')
        if lines and lines[0].strip().startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        output = '\n'.join(lines).strip()
        if not output:
            sys.stderr.write('EMPTY_RESPONSE\n')
            sys.exit(2)
        print(output)
        sys.exit(0)
except urllib.error.HTTPError as e:
    sys.stderr.write(f'HTTP_ERROR: {e.code} {e.reason}\n')
    sys.exit(1)
except Exception as e:
    sys.stderr.write(f'OLLAMA_ERROR: {e}\n')
    sys.exit(1)
