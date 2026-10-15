import { describe, expect, test } from 'bun:test';
import { beautifyHTML, convert, markdownToHtml, markdownToVisual } from './content';

describe('markdownToHtml', () => {
  test('headings get slug ids and inline markup', () => {
    expect(markdownToHtml('# Hello *World*')).toBe(
      '<h1 id="hello-world">Hello <em>World</em></h1>',
    );
  });

  test('lists, links and escaping', () => {
    const out = markdownToHtml('- a\n- [b](http://x.y)\n\nbreak\n\n1. one\n2. two');
    expect(out).toContain('<ul>\n<li>a</li>\n<li><a href="http://x.y">b</a></li>\n</ul>');
    expect(out).toContain('<ol>\n<li>one</li>\n<li>two</li>\n</ol>');
    expect(markdownToHtml('a < b & c')).toBe('<p>a &lt; b &amp; c</p>');
  });

  test('fenced code is escaped and raw html blocks pass through', () => {
    expect(markdownToHtml('```js\n<b>\n```')).toBe(
      '<pre><code class="language-js">&lt;b&gt;\n</code></pre>',
    );
    expect(markdownToHtml('<div>hi</div>')).toBe('<div>hi</div>');
  });

  test('template expressions survive', () => {
    expect(markdownToHtml('Hi {{ .Subscriber.FirstName }}')).toBe(
      '<p>Hi {{ .Subscriber.FirstName }}</p>',
    );
  });
});

describe('beautifyHTML', () => {
  test('indents block tags, keeps inline flow', () => {
    expect(beautifyHTML('<div><p>Hi <b>you</b></p></div>')).toBe(
      '<div>\n  <p>\n    Hi <b>you</b>\n  </p>\n</div>',
    );
  });

  test('raw tags are preserved verbatim', () => {
    expect(beautifyHTML('<style>a > b { x: 1 }</style>')).toContain('a > b { x: 1 }');
  });
});

describe('markdownToVisual', () => {
  test('headings become Heading blocks, other lines one Text block', () => {
    const v = markdownToVisual('# Title\nbody\nmore') as Record<string, any>;
    const ids: string[] = v.root.data.childrenIds;
    expect(ids).toHaveLength(2);
    expect(v[ids[0]!].type).toBe('Heading');
    expect(v[ids[0]!].data.props).toEqual({ text: 'Title', level: 'h1' });
    expect(v[ids[1]!].type).toBe('Text');
    expect(v[ids[1]!].data.props.text).toBe('body\nmore');
  });
});

describe('convert (DOM-free paths)', () => {
  test('markdown to html is beautified', () => {
    expect(convert('# A', 'markdown', 'html').body).toBe('<h1 id="a">A</h1>');
  });

  test('plain to html turns newlines into <br>', () => {
    expect(convert('a\nb', 'plain', 'html').body).toBe('a<br>\nb');
  });

  test('markdown to visual returns a JSON body source', () => {
    const { bodySource } = convert('# A', 'markdown', 'visual');
    expect(JSON.parse(bodySource ?? '').root.type).toBe('EmailLayout');
  });

  test('same-family text conversions leave the body alone', () => {
    expect(convert('x', 'plain', 'markdown')).toEqual({ body: 'x', bodySource: null });
  });
});
