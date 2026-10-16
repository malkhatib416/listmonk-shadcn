import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { themeInitScript } from '@/lib/theme';
import appCss from '@/styles.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'color-scheme', content: 'light dark' },
      { title: 'listmonk' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
