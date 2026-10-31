"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell, { Field, FormError, SubmitButton, inputClass } from "../../components/AuthShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "Use 8 or more characters." };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 14) score++;
  if (pw.length < 8) return { score: 1, label: "Too short — use 8 or more characters." };
  return { score, label: ["", "Weak", "Okay", "Good", "Strong"][score] };
}

const BAR_COLOR = ["bg-line", "bg-[#d6453d]", "bg-[#e8a317]", "bg-[#2f9e44]", "bg-[#2f9e44]"];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = passwordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your password needs at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
      switchText="Already have an account?"
      switchHref="/login"
      switchLabel="Log in"
      asideTitle="Know what breaks before you change it."
      asideBody="Archon maps every import and call in your repository, so a small change never surprises you in production."
    >
      <h1 className="text-[28px] font-medium tracking-[-0.03em] text-ink">Create your account</h1>
      <p className="mt-2 text-[15px] text-muted">Map your first repository in a couple of minutes.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <FormError message={error} />

        <Field id="name" label="Full name">
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className={inputClass}
          />
        </Field>

        <Field id="email" label="Work email">
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputClass}
          />
          <div className="mt-2.5 grid grid-cols-4 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-colors ${
                  strength.score >= i ? BAR_COLOR[strength.score] : "bg-line"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-faint" aria-live="polite">
            {strength.label}
          </p>
        </Field>

        <div className="pt-1">
          <SubmitButton loading={loading} loadingText="Creating account…">
            Create account
          </SubmitButton>
        </div>

        <p className="text-center text-[12px] leading-relaxed text-faint">
          By creating an account you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
