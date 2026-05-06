import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Shield } from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setUsername(user.username || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.updateSettings({ firstName, lastName, username });
      updateUser({ firstName, lastName, username });
      toast.success("Settings saved", { description: "Your profile has been updated successfully." });
    } catch (err: any) {
      toast.error("Update failed", {
        description: err.message || "Failed to update settings",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1.5">Account Settings</h1>
        <p className="text-sm text-muted">
          Manage your profile information and account preferences.
        </p>
      </div>

      <Card className="bg-surface-1 border-border ring-0">
        <CardHeader>
          <CardTitle className="text-white text-lg">Profile</CardTitle>
          <CardDescription className="text-muted">
            Update your personal details below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="first-name" className="text-xs text-muted">
                  First Name
                </Label>
                <Input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-10 bg-surface border-border text-white placeholder:text-muted/50"
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name" className="text-xs text-muted">
                  Last Name
                </Label>
                <Input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-10 bg-surface border-border text-white placeholder:text-muted/50"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs text-muted">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 bg-surface border-border text-white placeholder:text-muted/50"
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-display" className="text-xs text-muted">
                Email Address
              </Label>
              <Input
                id="email-display"
                type="email"
                value={user?.email || ""}
                disabled
                className="h-10 bg-surface border-border text-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted/60">
                Email cannot be changed for security reasons.
              </p>
            </div>

            <Separator className="bg-border" />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                className="h-10 px-6 bg-accent text-surface font-semibold hover:bg-accent/90 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator className="bg-border my-10" />

      <Card className="bg-surface-1 border-border ring-0 opacity-40">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Shield className="size-5" />
            Security
          </CardTitle>
          <CardDescription className="text-muted">
            Additional security options for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white mb-1">Two-Factor Authentication</h3>
              <p className="text-sm text-muted">Add an extra layer of security to your account.</p>
            </div>
            <Button variant="outline" disabled className="h-10 text-sm border-border text-muted">
              Enable 2FA
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
