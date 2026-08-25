import Image from "next/image";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Benar Systems &amp; Hobbies
        </h1>
        <p className="mt-6 text-base italic leading-relaxed text-foreground/80 sm:text-lg">
          Hi, I&apos;m Ben — I help small businesses automate their processes
          with simple digital solutions.
        </p>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
          Whether you need a custom business system or just want to talk
          pickleball, feel free to reach out.{" "}
          <strong className="font-semibold text-foreground">
            I&apos;m currently building a sports booking platform
          </strong>{" "}
          — starting with pickleball courts and expanding to other
          facilities soon.
        </p>

        <div className="mt-8 flex items-center gap-2 text-base font-medium sm:text-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-accent"
          >
            <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
            <rect x="2" y="4" width="20" height="16" rx="2" />
          </svg>
          <a href="mailto:benaremail@gmail.com" className="hover:underline">
            benaremail@gmail.com
          </a>
        </div>

        <div className="mt-14 grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border-2 border-transparent shadow-md transition-transform hover:scale-[1.02]">
            <Image
              src="/landing/systems.webp"
              alt="Business Systems"
              width={600}
              height={400}
              className="h-56 w-full object-cover"
            />
            <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              Business Systems
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border-2 border-transparent shadow-md transition-transform hover:scale-[1.02]">
            <Image
              src="/landing/pickleball.webp"
              alt="Pickleball"
              width={600}
              height={400}
              className="h-56 w-full object-cover"
            />
            <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              Pickleball
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
