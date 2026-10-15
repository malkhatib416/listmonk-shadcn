import { createFileRoute } from '@tanstack/react-router';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/next')({
  component: Foundation,
});

function Foundation() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">listmonk</h1>
        <ThemeToggle />
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Admin foundation</CardTitle>
          <CardDescription>
            Placeholder for the new admin. Pages are ported one at a time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex gap-2">
            <Badge>Badge</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <Input placeholder="Input" />
          <p className="text-muted-foreground text-sm">Muted text on the card background.</p>
        </CardContent>
      </Card>
    </main>
  );
}
