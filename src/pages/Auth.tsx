import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { resolveReferralCode, attachReferralOnSignup } from "@/lib/referrals-api";
import { supabase } from "@/integrations/supabase/client";

const REF_KEY = "pending_referral_code";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const { signIn, signUp, user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const code = params.get("ref") || localStorage.getItem(REF_KEY);
    if (!code) return;
    resolveReferralCode(code).then((r) => {
      if (r) {
        localStorage.setItem(REF_KEY, code);
        setReferrerName(r.display_name);
        setIsSignUp(true);
      }
    });
  }, [params]);

  useEffect(() => {
    if (loading || !user) return;
    const code = localStorage.getItem(REF_KEY);
    if (code) {
      attachReferralOnSignup(user.id, code).finally(() => localStorage.removeItem(REF_KEY));
    }
    if (role === "admin") navigate("/admin", { replace: true });
    else if (role) navigate("/", { replace: true });
  }, [user, role, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        toast.success("Account created successfully!");
        // If session is auto-active, attach now (otherwise effect handles it on login)
        const { data } = await supabase.auth.getSession();
        const code = localStorage.getItem(REF_KEY);
        if (data.session?.user && code) {
          await attachReferralOnSignup(data.session.user.id, code);
          localStorage.removeItem(REF_KEY);
        }
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: "var(--gradient-primary)" }}>
      <Button variant="ghost" size="sm" className="absolute top-4 left-4 gap-1 text-primary-foreground hover:bg-white/20" asChild>
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Home</Link>
      </Button>
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-2">
          <img src={logoColor} alt="Help A Pet" className="h-16 w-auto mx-auto" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </CardTitle>
          <CardDescription>
            {isSignUp ? "Join Help A Pet and take care of your furry friends" : "Sign in to your Help A Pet account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full text-base font-semibold h-11" disabled={submitting}>
              {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
