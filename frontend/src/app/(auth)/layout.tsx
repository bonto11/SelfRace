// src/app/(public)/layout.tsx
// src/app/(auth)/layout.tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className="bg-gray-900 text-gray-100">
        <header className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Trainalyze</div>
          <nav className="flex gap-3 text-sm">
            <a href="/signin" className="underline">Sign in</a>
            <a href="/signup" className="underline">Sign up</a>
          </nav>
        </header>
        <main className="max-w-md mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}