import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import logoLight from '@assets/Logo_1755373407688.png';
import logoDark from '@assets/Logo dark mode_1755373493360.png';

function PublicNav() {
  const { user } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Safety', href: '/safety' },
    { label: 'About', href: '/about' },
  ];

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'var(--pub-nav-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--pub-nav-border)' : '1px solid transparent',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoLight} alt="NaborNet" className="w-8 h-8 dark:hidden" />
          <img src={logoDark} alt="NaborNet" className="w-8 h-8 hidden dark:block" />
          <span className="font-semibold text-lg text-[var(--pub-text)]">NaborNet</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--pub-text-secondary)] hover:text-[var(--pub-text)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <Link href="/community/map">
              <Button size="sm" className="bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white">
                Open App
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white">
                Sign In
              </Button>
            </Link>
          )}
        </nav>

        <button
          className="md:hidden p-2 text-[var(--pub-text)]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden border-t px-4 pb-4 pt-2 space-y-3"
          style={{
            backgroundColor: 'var(--pub-nav-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderColor: 'var(--pub-nav-border)',
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm text-[var(--pub-text-secondary)] hover:text-[var(--pub-text)] py-2"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <Link href="/community/map" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white">
                Open App
              </Button>
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-[var(--pub-bg)] border-t border-[var(--pub-border)] py-10 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <img src={logoLight} alt="NaborNet" className="w-6 h-6 dark:hidden opacity-60" />
          <img src={logoDark} alt="NaborNet" className="w-6 h-6 hidden dark:block opacity-60" />
          <span className="text-[var(--pub-text-secondary)] font-medium">NaborNet</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--pub-text-secondary)]">
          <Link href="/about" className="hover:text-[var(--pub-text)] transition-colors">About</Link>
          <Link href="/how-it-works" className="hover:text-[var(--pub-text)] transition-colors">How it works</Link>
          <Link href="/safety" className="hover:text-[var(--pub-text)] transition-colors">Safety</Link>
          <Link href="/legal/terms" className="hover:text-[var(--pub-text)] transition-colors">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-[var(--pub-text)] transition-colors">Privacy</Link>
        </nav>
      </div>

      <div className="max-w-5xl mx-auto mt-6 text-center text-xs text-[var(--pub-text-secondary)]">
        © 2026 NaborNet. All rights reserved.
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--pub-bg)] text-[var(--pub-text)] min-h-screen">
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
