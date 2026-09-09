import Link from "next/link";
import LoginModal from "@/components/LoginModal";
import NavLinkPending from "@/components/NavLinkPending";
import MobileMenu from "@/components/MobileMenu";
import RegisterModal from "@/components/RegisterModal";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="text-lg font-semibold tracking-tight sm:text-xl">
          Ben Systems
        </span>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <MobileMenu>
            <Link
              href="/users"
              className="rounded-full border border-foreground/15 px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-foreground/10 sm:px-5 sm:text-base"
            >
              Users
              <NavLinkPending />
            </Link>
            <Link
              href="/sites"
              className="rounded-full border border-foreground/15 px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-foreground/10 sm:px-5 sm:text-base"
            >
              Sites
              <NavLinkPending />
            </Link>
            <Link
              href="/courts"
              className="rounded-full border border-foreground/15 px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-foreground/10 sm:px-5 sm:text-base"
            >
              Courts
              <NavLinkPending />
            </Link>
            <Link
              href="/time-ranges"
              className="rounded-full border border-foreground/15 px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-foreground/10 sm:px-5 sm:text-base"
            >
              Time Ranges
              <NavLinkPending />
            </Link>
            <RegisterModal />
            <LoginModal />
          </MobileMenu>
        </div>
      </nav>
    </header>
  );
}
