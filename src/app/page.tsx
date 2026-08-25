export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-2xl flex-col px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Benar Systems &amp; Hobbies
        </h1>
        <p className="mt-6 text-base italic leading-relaxed text-foreground/80 sm:text-lg">
          Hi, I&apos;m Ben — I help small businesses automate their processes
          with simple digital solutions.
        </p>
        <p className="mt-4 text-base leading-relaxed text-foreground/80 sm:text-lg">
          Whether you need a custom business system or just want to talk
          pickleball, feel free to reach out.{" "}
          <strong className="font-semibold text-foreground">
            I&apos;m currently building a sports booking platform
          </strong>{" "}
          — starting with pickleball courts and expanding to other
          facilities soon.
        </p>
      </section>
    </main>
  );
}
