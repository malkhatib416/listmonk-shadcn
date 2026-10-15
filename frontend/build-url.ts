// URL prefix the built assets are served under by Go (see cmd/init.go).
export const APP_BASE = '/admin/app/';

type HostType = 'js' | 'css' | 'html';

// Vite's experimental.renderBuiltUrl: makes built asset URLs honor a root-URL sub-path
// (app.root_url with a path), which is only known to Go at serve time.
export function renderBuiltUrl(
  filename: string,
  { hostType, ssr }: { hostType: HostType; ssr: boolean },
): string | { runtime: string } | { relative: true } | undefined {
  // Chunk and preload URLs resolved from JS. Go sets window._LM_ROOT when it serves the
  // shell (internal/adminapp/shell.go). Not on the server: there is no window there.
  if (hostType === 'js' && !ssr) {
    return {
      runtime: `(window._LM_ROOT||'')+${JSON.stringify(APP_BASE)}+${JSON.stringify(filename)}`,
    };
  }
  // Fonts and images referenced from CSS resolve against the stylesheet's own URL, which
  // Go already serves under the root path.
  if (hostType === 'css') return { relative: true };
  // HTML: the shell is rewritten by Go at serve time.
  return undefined;
}
