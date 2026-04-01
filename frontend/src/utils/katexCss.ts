const KATEX_FONT_FACE_RULE = /@font-face\s*\{[^{}]*\}/g

export function stripKatexFontFaceRules(css: string): string {
  return css.replace(KATEX_FONT_FACE_RULE, '')
}
