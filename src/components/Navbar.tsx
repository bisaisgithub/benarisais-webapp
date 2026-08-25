import RegisterModal from "@/components/RegisterModal";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-background/80 backdrop-blur-md dark:border-white/10">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="text-lg font-semibold tracking-tight sm:text-xl">
          Acme
        </span>

        <div className="flex items-center gap-3">
          <RegisterModal />

          <button
            type="button"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:px-5 sm:text-base"
          >
            Sign In
          </button>
        </div>
      </nav>
    </header>
  );
}
