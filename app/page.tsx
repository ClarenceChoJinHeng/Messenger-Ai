import Link from "next/link";

// The landing page (a server component: no state, no hooks)
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-widest text-blue-500 uppercase">Messenger AI</p>
        <h1 className="mb-4 text-4xl font-bold text-balance text-black sm:text-5xl">
          Chat with your friends. And with an AI that answers back.
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-zinc-600">
          Create an account, set up your profile, message other users, and ask Sparky, the built-in AI assistant,
          anything.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register" className="rounded-[10px] bg-black px-6 py-3 font-semibold text-white">
            Create an account
          </Link>
          <Link href="/login" className="rounded-[10px] bg-blue-500 px-6 py-3 font-semibold text-white">
            Log in
          </Link>
        </div>

        <ul className="mt-14 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Profiles", "Pick a display name and write a short bio."],
            ["Messaging", "One-on-one chats that update every few seconds."],
            ["Sparky AI", "Ask questions, get jokes, do quick maths."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-[10px] bg-white p-5 shadow-[0px_10px_25px_rgba(0,0,0,0.08)]">
              <h2 className="mb-1 font-semibold text-black">{title}</h2>
              <p className="text-sm text-zinc-600">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
