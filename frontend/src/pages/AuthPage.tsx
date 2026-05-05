import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signin, signup } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signin(email, password);
        toast.success("Welcome back!", { description: "You've signed in successfully." });
      } else {
        await signup(email, password);
        toast.success("Account created!", { description: "Your demo account is ready with $5,000 USD." });
      }
      navigate("/");
    } catch (err) {
      toast.error(mode === "signin" ? "Sign in failed" : "Sign up failed", {
        description: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-base font-semibold tracking-widest uppercase text-accent">
            Exness
          </h1>
          <p className="text-muted mt-1.5 text-sm">
            Trading Terminal
          </p>
        </div>

        <Card className="bg-surface-1 border-border ring-0">
          <CardHeader className="pb-0">
            <CardTitle className="sr-only">Authentication</CardTitle>
            <CardDescription className="sr-only">Sign in or create an account</CardDescription>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="w-full">
              <TabsList className="w-full bg-surface rounded-lg">
                <TabsTrigger value="signin" className="flex-1 text-xs data-[state=active]:bg-surface-2 data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1 text-xs data-[state=active]:bg-surface-2 data-[state=active]:text-white">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-in" className="text-[10px] text-muted uppercase tracking-wider">
                      Email
                    </Label>
                    <Input
                      id="email-in"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-surface border-border text-white placeholder:text-muted/40 focus-visible:border-accent focus-visible:ring-accent/20"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-in" className="text-[10px] text-muted uppercase tracking-wider">
                      Password
                    </Label>
                    <Input
                      id="pass-in"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-surface border-border text-white placeholder:text-muted/40 focus-visible:border-accent focus-visible:ring-accent/20"
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-surface font-medium hover:bg-accent/90 disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-up" className="text-[10px] text-muted uppercase tracking-wider">
                      Email
                    </Label>
                    <Input
                      id="email-up"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-surface border-border text-white placeholder:text-muted/40 focus-visible:border-accent focus-visible:ring-accent/20"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-up" className="text-[10px] text-muted uppercase tracking-wider">
                      Password
                    </Label>
                    <Input
                      id="pass-up"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-surface border-border text-white placeholder:text-muted/40 focus-visible:border-accent focus-visible:ring-accent/20"
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-surface font-medium hover:bg-accent/90 disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-0" />
        </Card>

        <p className="text-center text-muted/60 text-xs mt-6">
          Demo account starts with $5,000 USD
        </p>
      </div>
    </div>
  );
}
