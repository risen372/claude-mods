import type { Register } from 'claude-code'

const GUIDANCE = [
  'When you ask the user to choose a design direction (visual style, layout, look and feel),',
  'call AskUserQuestion with 3-4 options and give EVERY option a `preview`: a self-contained HTML',
  'mockup (inline <style>, no external assets, about 40-80 lines) that shows the direction on the',
  "user's real content: palette, type, spacing, and one hero plus one card or section. Give each",
  'a distinct personality; the label is its name and the description says what it is best for.',
  'A viewer renders the previews visually for the user, who then answers in Claude Code.',
].join(' ')

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const isHtml = (s: unknown): s is string => typeof s === 'string' && /<\w[^>]*>/.test(s)

type Q = { question: string; options: { label: string; description?: string; preview?: string }[] }

export const gallery = (questions: readonly Q[]): string | undefined => {
  const withPreview = questions.filter(q => q.options.some(o => isHtml(o.preview)))
  if (withPreview.length === 0) return undefined
  const sections = withPreview
    .map(q => {
      const cards = q.options
        .map(
          (o, i) => `<article>
  ${isHtml(o.preview) ? `<iframe sandbox srcdoc="${esc(o.preview)}"></iframe>` : '<div class="none">no preview</div>'}
  <h2><b>${i + 1}</b>${esc(o.label)}</h2>
  <p>${esc(o.description ?? '')}</p>
</article>`,
        )
        .join('\n')
      return `<section><h1>${esc(q.question)}</h1><div class="grid">${cards}</div></section>`
    })
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Design direction</title>
<style>
body{margin:0;padding:28px;background:#ece9e4;font:14px/1.45 system-ui,sans-serif;color:#1c1b19}
h1{font-size:20px;margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px}
article{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px #0002;padding-bottom:12px}
iframe{width:100%;height:340px;border:0;display:block;background:#fff;border-bottom:1px solid #0001}
.none{height:340px;display:grid;place-items:center;color:#888}
h2{font-size:16px;margin:12px 16px 4px;display:flex;align-items:center;gap:8px}
h2 b{background:#1c1b19;color:#fff;border-radius:5px;padding:1px 8px;font-size:14px}
p{margin:0 16px;color:#555}
footer{margin-top:22px;color:#666}
</style>${sections}<footer>Press the number in Claude Code to choose.</footer>`
}

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    return {
      sections: [...out.sections, { id: `${$.plugin.name}:guidance`, text: GUIDANCE, scope: 'session' }],
    }
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    try {
      const html = gallery(e.questions as unknown as Q[])
      if (html) {
        const root = $.plugin.root
        const file = `${root}/gallery/${e.tool_use_id}.html`
        await $.fs.write(file, html)
        const argv = /^[A-Za-z]:|\\/.test(root)
          ? ['cmd', '/c', 'start', '', file.replace(/\//g, '\\')]
          : root.startsWith('/Users')
            ? ['open', file]
            : ['xdg-open', file]
        await $.process.run(argv, { timeoutMs: 10000 })
        $.ui.toast('Design options opened in your browser')
      }
    } catch (err) {
      $.ui.log(`design-direction: gallery failed: ${String(err)}`, { to: 'debug' })
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}
