import type { Register } from 'claude-code'

type Tell = { label: string; pattern: RegExp; hint: string }

const TELLS: readonly Tell[] = [
  { label: 'em dash', pattern: /\u2014/g, hint: 'use a comma, period or parentheses' },
  { label: 'stock opener', pattern: /(^|\n)\s*(certainly|absolutely|great question|sure thing|of course)[!,.]/gi, hint: 'just start with the answer' },
  { label: 'delve/tapestry words', pattern: /\b(delve[sd]?|tapestry|testament|beacon|realm|landscape of|multifaceted|myriad|plethora|intricate|pivotal|vibrant|seamless(ly)?|robust|holistic|synergy|paradigm)\b/gi, hint: 'use plainer words' },
  { label: 'hype verbs', pattern: /\b(leverag(e|es|ed|ing)|utiliz(e|es|ed|ing)|elevate[sd]?|unlock(s|ed|ing)?|streamlin(e|es|ed|ing)|foster(s|ed|ing)?|underscor(e|es|ed|ing)|showcas(e|es|ed|ing))\b/gi, hint: 'say use, improve, show' },
  { label: 'filler phrase', pattern: /(it'?s (important|worth) (to note|noting)|in today'?s (fast-paced|digital)|when it comes to|at the end of the day|in conclusion|in summary|moving forward|needless to say)/gi, hint: 'cut it' },
  { label: 'not-just-but framing', pattern: /\bnot (just|only|merely)\b[^.\n]{1,60}\bbut (also )?\b/gi, hint: 'state the point directly' },
  { label: 'closing offer', pattern: /(let me know if (you|there)|feel free to|i hope this helps|happy to help|don'?t hesitate to)/gi, hint: 'drop the sign-off' },
  { label: 'emoji', pattern: /[\u{1F300}-\u{1FAFF}\u2705\u274C\u2728]/gu, hint: 'drop decorative emoji' },
]

const STYLE = [
  'Voice: write like a competent colleague typing quickly, not like a press release.',
  'Use plain words and contractions. Vary sentence length. Start with the answer.',
  'Avoid em dashes, "delve", "leverage", "seamless", "robust", "pivotal", "tapestry", and "not just X but Y" framing.',
  'No stock openers ("Certainly!", "Great question!") and no closing offers ("Let me know if...", "I hope this helps").',
  'No decorative emoji, no needless headers or bullet lists for short answers, no summary that repeats what you just said.',
  'Prefer concrete specifics over vague praise. Say "I don\'t know" or "I haven\'t checked" when true.',
].join('\n')

export const scan = (text: string): { label: string; count: number; hint: string }[] =>
  TELLS.flatMap(t => {
    const count = (text.match(t.pattern) ?? []).length
    return count > 0 ? [{ label: t.label, count, hint: t.hint }] : []
  })

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    return {
      sections: [...out.sections, { id: `${$.plugin.name}:voice`, text: STYLE, scope: 'session' as const }],
    }
  })

  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return out

    const found = scan(e.answer)
    if (found.length === 0) {
      $.ui.status(undefined)
      return out
    }

    const total = found.reduce((n, f) => n + f.count, 0)
    $.ui.status(`human-voice: ${total} AI tell${total === 1 ? '' : 's'}`)
    const lines = found.map(f => `- ${f.label} x${f.count}: ${f.hint}`)
    return { ...out, text: `${out.text}\n\nhuman-voice check, ${total} possible AI tell${total === 1 ? '' : 's'}:\n${lines.join('\n')}` }
  })
}
