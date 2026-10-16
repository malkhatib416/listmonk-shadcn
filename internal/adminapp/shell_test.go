package adminapp

import (
	"strings"
	"testing"
)

const sampleShell = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>` +
	`<link rel="stylesheet" href="/admin/app/assets/app-abc.css"/></head>` +
	`<body><script type="module" src="/admin/app/assets/main-def.js"></script></body></html>`

func TestRewriteShellNoRootPath(t *testing.T) {
	for _, root := range []string{"", "/"} {
		out := string(RewriteShell([]byte(sampleShell), root, ""))

		if !strings.Contains(out, `href="/admin/app/assets/app-abc.css"`) {
			t.Fatalf("root %q: asset URL changed: %s", root, out)
		}
		// The runtime root is injected as the very first thing in <head>.
		if !strings.Contains(out, `<head><script>window._LM_ROOT="";</script><meta`) {
			t.Fatalf("root %q: _LM_ROOT not injected first: %s", root, out)
		}
	}
}

func TestRewriteShellWithRootPath(t *testing.T) {
	out := string(RewriteShell([]byte(sampleShell), "/lm", ""))

	for _, want := range []string{
		`href="/lm/admin/app/assets/app-abc.css"`,
		`src="/lm/admin/app/assets/main-def.js"`,
		`window._LM_ROOT="/lm";`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in: %s", want, out)
		}
	}
	if strings.Contains(out, `"/admin/app/`) {
		t.Fatalf("an unprefixed asset URL is left: %s", out)
	}
}

func TestRewriteShellTrailingSlashRootPath(t *testing.T) {
	out := string(RewriteShell([]byte(sampleShell), "/lm/", ""))
	if !strings.Contains(out, `href="/lm/admin/app/assets/app-abc.css"`) {
		t.Fatalf("trailing slash not trimmed: %s", out)
	}
}

// cmd.initUrlConfig builds RootPath as "/" + url.Path, so a root_url of
// https://host/lm arrives here as "//lm".
func TestRewriteShellNormalizesDoubleSlashRootPath(t *testing.T) {
	for _, root := range []string{"//lm", "//lm/", "/lm//"} {
		out := string(RewriteShell([]byte(sampleShell), root, ""))

		if !strings.Contains(out, `href="/lm/admin/app/assets/app-abc.css"`) ||
			!strings.Contains(out, `window._LM_ROOT="/lm";`) {
			t.Fatalf("root %q not normalized to /lm: %s", root, out)
		}
	}
}

func TestRewriteShellRejectsUnsafeRootPath(t *testing.T) {
	for _, root := range []string{`/a</script><b>`, `/a"b`, `/a b`} {
		out := string(RewriteShell([]byte(sampleShell), root, ""))

		if strings.Contains(out, "<b>") || strings.Contains(out, `a"b`) {
			t.Fatalf("root %q leaked into output: %s", root, out)
		}
		// Treated as no root path.
		if !strings.Contains(out, `window._LM_ROOT="";`) {
			t.Fatalf("root %q: expected fallback to empty root: %s", root, out)
		}
	}
}

func TestRewriteShellWithoutHead(t *testing.T) {
	// A shell without <head> is returned unmodified apart from the asset prefix.
	out := string(RewriteShell([]byte(`<p src="/admin/app/x.js">`), "/lm", ""))
	if out != `<p src="/lm/admin/app/x.js">` {
		t.Fatalf("unexpected output: %s", out)
	}
}

// The admin's custom CSS/JS (Settings > Appearance) must load on every ported page.
// The CSS goes last in <head> so it overrides the app styles.
func TestRewriteShellLinksCustomAssets(t *testing.T) {
	for root, p := range map[string]string{"": "", "/lm": "/lm"} {
		out := string(RewriteShell([]byte(sampleShell), root, ""))

		css := `<link rel="stylesheet" href="` + p + `/admin/custom.css"/></head>`
		js := `<script src="` + p + `/admin/custom.js" defer></script>`
		if !strings.Contains(out, css) {
			t.Fatalf("root %q: custom.css not linked last in <head>: %s", root, out)
		}
		if !strings.Contains(out, js) {
			t.Fatalf("root %q: custom.js not included: %s", root, out)
		}
	}
}

func TestRewriteShellFavicon(t *testing.T) {
	// Without a configured favicon the bundled one is linked, under the root path.
	out := string(RewriteShell([]byte(sampleShell), "/lm", ""))
	if !strings.Contains(out, `<link rel="icon" href="/lm/admin/app/favicon.png"/>`) {
		t.Fatalf("default favicon missing: %s", out)
	}

	// A configured favicon wins, and is escaped for the attribute.
	out = string(RewriteShell([]byte(sampleShell), "", `https://x.test/f.ico?a=1&b="2"`))
	if !strings.Contains(out, `<link rel="icon" href="https://x.test/f.ico?a=1&amp;b=&#34;2&#34;"/>`) {
		t.Fatalf("custom favicon missing or unescaped: %s", out)
	}
	if strings.Contains(out, "favicon.png") {
		t.Fatalf("default favicon also linked: %s", out)
	}
}
