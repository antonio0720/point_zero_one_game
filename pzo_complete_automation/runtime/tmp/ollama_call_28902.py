import json, urllib.request, sys, os

host = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')
model = os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')

task_type = """create_docs"""
out_path = """docs/pzo/specs/Point_Zero_One_Deployment_Complete.md"""
spec = """Deployment + GTM spec (source: logic_docs/Point_Zero_One_Deployment_Complete.md)"""
ext = """md"""

lang_map = {'ts': 'TypeScript', 'tsx': 'TypeScript React', 'sh': 'Bash', 'md': 'Markdown', 'py': 'Python'}
lang = lang_map.get(ext, 'text')

if task_type in ('create_module', 'implement_feature'):
    prompt = f"""You are an expert {lang} developer for Point Zero One Digital, a financial roguelike game engine.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete file contents. No explanation. No markdown fences. No preamble.
- TypeScript: strict types, no any, export all public symbols
- Bash: set -euo pipefail, safe defaults
- ML models: include ml_enabled kill-switch, bounded outputs 0-1, audit_hash
- Engine: preserve determinism

Output the complete {ext} file now:"""

elif task_type == 'create_test':
    prompt = f"""You are an expert TypeScript/Vitest developer for Point Zero One Digital.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete test file. No explanation. No markdown fences.
- Use: import {{ describe, it, expect }} from 'vitest'
- Tests must be deterministic

Output the complete test file now:"""

elif task_type == 'create_docs':
    prompt = f"""You are a technical writer for Point Zero One Digital.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete markdown document. No preamble.
- Precise, execution-grade. No fluff.

Output the complete markdown document now:"""

elif task_type == 'create_contract':
    prompt = f"""You are an expert TypeScript developer for Point Zero One Digital.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete TypeScript file
- Export all interfaces, enums, types
- Include JSDoc comments

Output the complete file now:"""

else:
    prompt = f"Generate content for: {out_path}\nSpec: {spec}\nOutput the complete file:"

payload = json.dumps({
    'model': model,
    'prompt': prompt,
    'stream': False,
    'options': {'temperature': 0.1, 'num_predict': 4096}
}).encode('utf-8')

req = urllib.request.Request(
    f'{host}/api/generate',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
        text = data.get('response', '')
        lines = text.split('\n')
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        print('\n'.join(lines))
        sys.exit(0)
except Exception as e:
    sys.stderr.write(f'OLLAMA_ERROR: {e}\n')
    sys.exit(1)
