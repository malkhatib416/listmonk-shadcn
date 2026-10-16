package adminapp

import "strings"

// CacheControl returns the Cache-Control header for a static file. Most files get long
// cache headers: new dists have a `?v=.AssetVersion` param that changes, so that busts
// the cache, and the admin build's assets/ files carry a content hash in their names.
// Files of the admin build that keep a fixed name (favicon, email builder) have neither,
// so they are revalidated.
func CacheControl(p string) string {
	if strings.HasPrefix(p, AssetPrefix) && !strings.HasPrefix(p, AssetPrefix+"assets/") {
		return "no-cache"
	}
	return "public, max-age=31536000, immutable"
}
