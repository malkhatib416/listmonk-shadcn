package adminapp

import "testing"

func TestCacheControl(t *testing.T) {
	const immutable = "public, max-age=31536000, immutable"
	cases := map[string]string{
		// Hashed build output never changes under its name.
		"/admin/app/assets/index-abc123.js": immutable,
		// Versioned by the ?v= query the templates add.
		"/public/static/style.css": immutable,
		// Fixed names under the app prefix must be revalidated after an upgrade.
		"/admin/app/favicon.png":                        "no-cache",
		"/admin/app/email-builder/email-builder.umd.js": "no-cache",
	}
	for p, want := range cases {
		if got := CacheControl(p); got != want {
			t.Errorf("%s: got %q, want %q", p, got, want)
		}
	}
}
