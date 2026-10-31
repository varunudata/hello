"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell, { Field, FormError, SubmitButton, inputClass } from "../../components/AuthShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      localStorage.setItem("archon_token", data.token);
      localStorage.setItem("archon_user", JSON.stringify(data.user));
      router.push("/home");
    } catch {
      setError("We couldn't reach the server. Make sure the API is running on port 4000.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      switchText="New to Archon?"
      switchHref="/signup"
      switchLabel="Create an account"
      asideTitle="Pick up where you left off."
      asideBody="Your repositories, maps and saved questions are waiting for you."
    >
      <h1 className="text-[28px] font-medium tracking-[-0.03em] text-ink">Log in</h1>
      <p className="mt-2 text-[15px] text-muted">Welcome back. Enter your details to continue.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <FormError message={error} />

        <Field id="email" label="Email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputClass}
          />
        </Field>

        <Field
          id="password"
          label="Password"
          hint={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-[13px] text-muted transition-colors hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        >
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={inputClass}
          />
        </Field>

        <div className="pt-1">
          <SubmitButton loading={loading} loadingText="Logging in…">
            Log in
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
