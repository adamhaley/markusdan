import json
with open('/Users/adamhaley/.claude/projects/-opt-homebrew-var-www-markusdan/3ff5fb45-283a-47ce-8bfd-39c15d22b46e.jsonl') as f:
    lines = f.readlines()
out = []
out.append(str(len(lines)))
for l in lines:
    try:
        d = json.loads(l)
    except Exception:
        continue
    t = d.get('type')
    if t in ('user', 'assistant'):
        msg = d.get('message', {})
        role = msg.get('role')
        content = msg.get('content')
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            parts = []
            for c in content:
                if isinstance(c, dict):
                    if c.get('type') == 'text':
                        parts.append(c['text'])
                    elif c.get('type') == 'tool_use':
                        parts.append(f"[TOOL:{c.get('name')} {json.dumps(c.get('input'))[:200]}]")
                    elif c.get('type') == 'tool_result':
                        cont = c.get('content')
                        if isinstance(cont, list):
                            cont = ' '.join(x.get('text', '') for x in cont if isinstance(x, dict))
                        parts.append(f"[RESULT: {str(cont)[:200]}]")
            text = ' '.join(parts)
        else:
            text = str(content)
        out.append(f'--- {role} ---')
        out.append(text[:500])

with open('/opt/homebrew/var/www/markusdan/.transcript_out.txt', 'w') as f:
    f.write('\n'.join(out))
