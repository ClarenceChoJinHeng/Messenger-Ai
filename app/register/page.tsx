"use client";
import { useState, type SubmitEvent } from "react";

export default function Register() {
  // Put your logic here, remember this is a function :D
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorUsername, setUsernameError] = useState<string | null>(null);
  const [errorEmail, setEmailError] = useState<string | null>(null);
  const [errorPassword, setPasswordError] = useState<string | null>(null);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validation
    setUsernameError(null);
    setEmailError(null);
    setPasswordError(null);
    if (username.trim() === "") {
      setUsernameError("Username cannot be empty!");
      return;
    } else if (username.trim().length < 3) {
      setUsernameError("Username cannot be less then 3 characters!");
      return;
    } else if (username.trim().length > 20) {
      setUsernameError("Username cannot be more then 20 characters!");
      return;
    } else if (username.includes(" ")) {
      setUsernameError("Username cannot have space!");
      return;
    } else if (email.trim() === "") {
      setEmailError("Email cannot be empty!");
      return;
    } else if (email.includes(" ")) {
      setEmailError("Email cannot have space!");
      return;
    } else if (password.trim() === "") {
      setPasswordError("Password cannot be empty!");
      return;
    } else if (password.length < 8) {
      setPasswordError("Password cannot be less than 8 characters!");
      return;
    } else if (password === username) {
      setPasswordError("Password cannot be the same as your Username!");
      return;
    } else if (password.includes(" ")) {
      setPasswordError("Password cannot have space!");
      return;
    }

    const newUser = {
      username,
      email,
      password,
    };

    console.log("New User Value", newUser.username, newUser.email, newUser.password);
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="mx-3 w-full max-w-[400px] rounded-[10px] p-5 text-black shadow-[0px_15px_35px_rgba(0,0,0,0.26)]">
        <h1 className="mb-3 text-[30px] font-[600]">Sign Up</h1>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <label htmlFor="username">Username</label>
            <input
              className="rounded-[5px] border-[1px] border-black px-2 py-2"
              type="text"
              placeholder="Username"
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {errorUsername && (
              <p className="text-[13px] font-[600] text-red-500">{errorUsername}</p>
            )}
          </div>
          <div className="flex flex-col">
            <label htmlFor="email">Email:</label>
            <input
              className="rounded-[5px] border-[1px] border-black px-2 py-2"
              type="email"
              placeholder="Email"
              id="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errorEmail && <p className="text-[13px] font-[600] text-red-500">{errorEmail}</p>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="password">Password</label>
            <input
              className="rounded-[5px] border-[1px] border-black px-2 py-2"
              type="password"
              placeholder="Password"
              id="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errorPassword && (
              <p className="text-[13px] font-[600] text-red-500">{errorPassword}</p>
            )}
          </div>
          <div className="flex flex-col">
            <button
              type="submit"
              className="rounded-[8px] bg-black px-3 py-2 font-[600] text-white hover:cursor-pointer"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
