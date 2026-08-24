const features = [
  {
    title: "Fast by default",
    description:
      "Built on modern tooling so every page loads quickly, on every device and connection.",
  },
  {
    title: "Fully responsive",
    description:
      "Looks great from small phones to ultra-wide monitors, with layouts that adapt at every breakpoint.",
  },
  {
    title: "Simple to extend",
    description:
      "A clean starting point you can build on, one feature at a time, without fighting the framework.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Build something great, starting today
        </h1>
        <p className="mt-4 max-w-xl text-base text-foreground/70 sm:mt-6 sm:text-lg lg:text-xl">
          A clean, fully responsive foundation for your next project. Simple,
          fast, and ready to grow with you.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:justify-center">
          <button
            type="button"
            className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto sm:text-base"
          >
            Get Started
          </button>
          <button
            type="button"
            className="w-full rounded-full border border-black/10 px-6 py-3 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 sm:w-auto sm:text-base"
          >
            Learn More
          </button>
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-16 sm:grid-cols-2 sm:px-6 sm:py-20 lg:grid-cols-3 lg:px-8">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold sm:text-xl">
                {feature.title}
              </h2>
              <p className="text-sm text-foreground/70 sm:text-base">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-foreground/60 sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <span>© {new Date().getFullYear()} Acme. All rights reserved.</span>
          <span>Made with Next.js</span>
        </div>
      </footer>
    </main>
  );
}
