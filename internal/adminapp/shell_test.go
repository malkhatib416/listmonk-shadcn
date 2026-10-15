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
		out := string(RewriteShell([]byte(sampleShell), root))

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
	out := string(RewriteShell([]byte(sampleShell), "/lm"))

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
	out := string(RewriteShell([]byte(sampleShell), "/lm/"))
	if !strings.Contains(out, `href="/lm/admin/app/assets/app-abc.css"`) {
		t.Fatalf("trailing slash not trimmed: %s", out)
	}
}

func TestRewriteShellRejectsUnsafeRootPath(t *testing.T) {
	for _, root := range []string{`/a</script><b>`, `/a"b`, `/a b`, `//evil`} {
		out := string(RewriteShell([]byte(sampleShell), root))

		if strings.Contains(out, "<b>") || strings.Contains(out, `a"b`) || strings.Contains(out, "evil") {
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
	out := string(RewriteShell([]byte(`<p src="/admin/app/x.js">`), "/lm"))
	if out != `<p src="/lm/admin/app/x.js">` {
		t.Fatalf("unexpected output: %s", out)
	}
}
