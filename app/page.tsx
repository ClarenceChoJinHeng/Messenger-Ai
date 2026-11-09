import Link from "next/link";

// The landing page (a server component: no state, no hooks)
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-page px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-widest text-blue-500 uppercase">Messenger AI</p>
        <h1 className="mb-4 text-4xl font-bold text-balance text-ink sm:text-5xl">
          Chat with your friends. And with an AI that answers back.
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-muted">
          Create an account, set up your profile, message other users, and ask Sparky, the built-in AI assistant,
          anything.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register" className="rounded-[10px] bg-accent px-6 py-3 font-semibold text-accent-ink">
            Create an account
          </Link>
          <Link href="/login" className="rounded-[10px] bg-blue-500 px-6 py-3 font-semibold text-white">
            Log in
          </Link>
        </div>

        <ul className="mt-14 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Profiles", "Display name, bio, and a grey or black theme."],
            ["Messaging", "One-on-one chats with photos, videos, emojis and alerts."],
            ["Sparky AI", "Ask questions, get jokes, do quick maths."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-[10px] bg-surface p-5 shadow-[0px_10px_25px_rgba(0,0,0,0.08)]">
              <h2 className="mb-1 font-semibold text-ink">{title}</h2>
              <p className="text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
