import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, Spinner } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useLogin, useSignup } from "@/lib/queries";
import { ApiError } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { token, loginWith } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const signup = useSignup();
  const mutation = mode === "login" ? login : signup;

  if (token) return <Navigate to="/app" replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(
      { email, password },
      { onSuccess: (res) => { loginWith(res); navigate("/app"); } }
    );
  }

  const isLogin = mode === "login";
  const error =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong. Please try again."
        : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="text-lg font-bold">
          doss<span className="text-primary">i</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-bold">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLogin ? "Log in to your research workspace." : "Start prepping for meetings in minutes."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <Input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <Input
                id="password" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              {isLogin ? "Log in" : "Sign up"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isLogin ? "No account yet? " : "Already have an account? "}
            <Link to={isLogin ? "/signup" : "/login"} className="font-medium text-primary">
              {isLogin ? "Sign up" : "Log in"}
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
