import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign Up — Spicy Bite" },
      { name: "description", content: "Create your Spicy Bite account to order online." },
      { property: "og:title", content: "Sign Up — Spicy Bite" },
      { property: "og:description", content: "Create your Spicy Bite account to order online." },
    ],
  }),
  component: AuthPage,
});

async function routeByRole(userId: string): Promise<string> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("manager")) return "/manager";
  if (roles.includes("driver")) return "/driver";
  return "/menu";
}

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name, phone } },
      });
      if (error) { setLoading(false); return toast.error(error.message); }
      if (data.session) {
        const to = await routeByRole(data.user!.id);
        setLoading(false);
        toast.success("Welcome to Spicy Bite!");
        router.navigate({ to });
      } else {
        setLoading(false);
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setLoading(false); return toast.error(error.message); }
      const to = await routeByRole(data.user.id);
      setLoading(false);
      toast.success("Signed in");
      router.navigate({ to });
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <h1 className="font-display text-3xl">
            <span className="text-primary">{mode === "signin" ? "SIGN IN" : "SIGN UP"}</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign up to place orders. Staff accounts get their dashboards automatically.
          </p>
          <div className="mt-4 space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
                </div>
              </>
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
