export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-2xl flex-col px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          About me
        </h1>
        <p className="mt-6 text-base leading-relaxed text-foreground/80 sm:text-lg">
          I love collaborating with anyone who wants to build systems.
        </p>
        <p className="mt-4 text-base leading-relaxed text-foreground/80 sm:text-lg">
          Outside of building, you&apos;ll find me on the court playing
          pickleball and tennis.
        </p>
      </section>
    </main>
  );
}
