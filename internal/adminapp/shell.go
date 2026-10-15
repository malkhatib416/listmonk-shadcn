// Package adminapp serves the SPA shell of the new admin frontend (frontend/).
package adminapp

import (
	"bytes"
	"encoding/json"
	"path"
	"regexp"
	"strings"
)

const (
	// AssetPrefix is the URL (and stuffbin) prefix the frontend build is served under.
	AssetPrefix = "/admin/app/"

	// ShellPath is the stuffbin path of the prerendered SPA shell.
	ShellPath = AssetPrefix + "_shell.html"
)

// reSafeRootPath matches a conservative URL path: it is interpolated into HTML
// attributes and a <script> block, so anything else is ignored.
var reSafeRootPath = regexp.MustCompile(`^/[A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)*$`)

// RewriteShell prepares the built shell for serving. rootPath is the path
// component of app.root_url ("/" or "" when there is none). It prefixes asset
// URLs with rootPath and injects window._LM_ROOT as the first element of <head>,
// which the frontend uses for the router basepath and lazy chunk URLs.
func RewriteShell(shell []byte, rootPath string) []byte {
	// Collapse repeated slashes: the caller builds rootPath as "/" + url.Path, which
	// yields "//lm" for a root_url of https://host/lm.
	prefix := strings.TrimRight(path.Clean("/"+rootPath), "/")
	if prefix != "" && !reSafeRootPath.MatchString(prefix) {
		prefix = ""
	}

	out := shell
	if prefix != "" {
		out = bytes.ReplaceAll(out, []byte(AssetPrefix), []byte(prefix+AssetPrefix))
	}

	// json.Marshal escapes <, > and & so the value is safe inside <script>.
	root, _ := json.Marshal(prefix)
	script := []byte(`<script>window._LM_ROOT=` + string(root) + `;</script>`)

	i := bytes.Index(out, []byte("<head"))
	if i < 0 {
		return out
	}
	end := bytes.IndexByte(out[i:], '>')
	if end < 0 {
		return out
	}
	at := i + end + 1

	res := make([]byte, 0, len(out)+len(script))
	res = append(res, out[:at]...)
	res = append(res, script...)
	res = append(res, out[at:]...)
	return res
}
