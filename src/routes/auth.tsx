import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign in — Spicy Bite" },
      { name: "description", content: "Sign in to manage Spicy Bite orders and branches." },
      { property: "og:title", content: "Staff Sign in — Spicy Bite" },
      { property: "og:description", content: "Staff sign-in for Spicy Bite." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Account created. You can sign in now.");
      setMode("signin");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Signed in");
      router.navigate({ to: "/admin" });
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <h1 className="font-display text-3xl"><span className="text-primary">STAFF</span> {mode === "signin" ? "SIGN IN" : "SIGN UP"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Customers can order without an account.</p>
          <div className="mt-4 space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-muted-foreground">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </div>
            <button onClick={submit} disabled={loading} className="w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-center text-xs text-muted-foreground hover:text-primary">
              {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
