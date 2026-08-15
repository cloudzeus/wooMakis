import { describe, it, expect } from 'vitest'
import { htmlToText, isEmptyHtml, sanitizeHtml } from '@/lib/sanitize-html'

describe('sanitizeHtml', () => {
  it('keeps the formatting a product description needs', () => {
    const input = '<p><strong>Φακοί</strong> με <em>υδρογέλη</em></p><ul><li>Μηνιαίοι</li></ul>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('removes scripts with their contents', () => {
    expect(sanitizeHtml('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>')
  })

  it('removes an unclosed script to the end of the input', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)')).toBe('<p>ok</p>')
  })

  it('drops style, iframe and object entirely', () => {
    expect(sanitizeHtml('<style>body{}</style><iframe src="x"></iframe><object></object>')).toBe('')
  })

  it('strips every attribute from ordinary tags', () => {
    expect(sanitizeHtml('<p class="x" onclick="alert(1)" style="color:red">hi</p>'))
      .toBe('<p>hi</p>')
  })

  it('removes event handlers even on allowed tags', () => {
    expect(sanitizeHtml('<strong onmouseover="steal()">x</strong>')).toBe('<strong>x</strong>')
  })

  it('keeps a safe link and forces rel', () => {
    expect(sanitizeHtml('<a href="https://example.com">x</a>'))
      .toBe('<a href="https://example.com" target="_blank" rel="noreferrer noopener">x</a>')
  })

  it('drops a javascript: link but keeps its text', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('click</a>')
  })

  it('drops a javascript: link obfuscated with control characters', () => {
    // "java\tscript:" is a real historical bypass.
    expect(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')).not.toContain('href')
  })

  it('drops protocol-relative links', () => {
    expect(sanitizeHtml('<a href="//evil.example">x</a>')).not.toContain('href')
  })

  it('allows a site-relative link', () => {
    expect(sanitizeHtml('<a href="/proionta">x</a>')).toContain('href="/proionta"')
  })

  it('strips comments, which can hide markup', () => {
    expect(sanitizeHtml('<p>a</p><!-- <script>x</script> --><p>b</p>')).toBe('<p>a</p><p>b</p>')
  })

  it('removes unknown tags but keeps their text', () => {
    expect(sanitizeHtml('<div><span>text</span></div>')).toBe('text')
  })

  it('escapes quotes in an href', () => {
    expect(sanitizeHtml('<a href=\'https://x.com/"onmouseover="alert(1)\'>x</a>'))
      .not.toContain('onmouseover="alert')
  })
})

describe('htmlToText', () => {
  it('flattens markup and entities', () => {
    expect(htmlToText('<p>a &amp; <strong>b</strong></p>')).toBe('a & b')
  })
})

describe('isEmptyHtml', () => {
  it('treats markup with no text as empty', () => {
    expect(isEmptyHtml('<p></p><br />')).toBe(true)
    expect(isEmptyHtml('<p>x</p>')).toBe(false)
  })
})
