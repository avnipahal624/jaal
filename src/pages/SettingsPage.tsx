import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Chip, Panel } from "@/components/ui/panel";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useJaal } from "@/state/JaalProvider";
import {
  SCAM_CATEGORIES,
  type DetectionMode,
  type ScamCategory,
} from "@/types/investigation";
import type { AnimationIntensity, Density } from "@/types/settings";
import { motion } from "framer-motion";
import {
  Palette,
  Radio,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-jtext">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-jmuted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex border border-jborder/70">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
            value === o.id
              ? "bg-jcyan/15 text-jcyan"
              : "text-jmuted hover:text-jtext",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { state, updateSettings, resetCase, resetDemoData, signOutDemo, updateProfile } =
    useJaal();
  const { user: authUser, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const { appearance, investigation, simulation } = state.settings;

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const sessionName =
    state.user?.name ?? authUser?.name ?? "Simulation Operator";
  const displayName = nameDraft ?? sessionName;
  const [resetTarget, setResetTarget] = useState<string>(
    state.investigations.find((i) => i.status === "active")?.id ??
      state.investigations[0]?.id ??
      "",
  );

  const activeCases = state.investigations.filter((i) => i.status !== "archived");

  const handleSaveProfile = () => {
    updateProfile(displayName);
    setNameDraft(null);
    toast.success("Display name updated", { duration: 1600 });
  };

  const handleSignOut = async () => {
    try {
      if (isAuthenticated) await signOut();
    } catch {
      /* ignore */
    }
    signOutDemo();
    navigate("/");
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5"
      >
        <p className="jaal-label">Console configuration</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-jtext sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-jmuted">
          Preferences apply immediately and persist locally on this device.
        </p>
      </motion.header>

      <div className="space-y-4">
        {/* Appearance */}
        <Panel
          label={
            <div className="flex items-center gap-2">
              <Palette className="size-3.5 text-jcyan" />
              <p className="jaal-label">Appearance</p>
            </div>
          }
          bodyClassName="divide-y divide-jborder/40"
        >
          <Row
            title="Theme"
            description="The dark cyber-forensics theme is the JAAL default and only theme."
          >
            <Chip tone="border-jcyan/50 bg-jcyan/10 text-jcyan">dark · locked</Chip>
          </Row>
          <Row
            title="Animation intensity"
            description="Controls the strength of pulses, sweeps and hover motion."
          >
            <Segmented<AnimationIntensity>
              value={appearance.animationIntensity}
              onChange={(v) =>
                updateSettings({ appearance: { animationIntensity: v } })
              }
              options={[
                { id: "subtle", label: "Subtle" },
                { id: "standard", label: "Standard" },
                { id: "vivid", label: "Vivid" },
              ]}
            />
          </Row>
          <Row
            title="Density"
            description="Compact trims row padding across feeds and lists."
          >
            <Segmented<Density>
              value={appearance.density}
              onChange={(v) => updateSettings({ appearance: { density: v } })}
              options={[
                { id: "compact", label: "Compact" },
                { id: "comfortable", label: "Comfortable" },
              ]}
            />
          </Row>
          <Row
            title="Reduced motion"
            description="Disable panel motion, pulses and sweeps. The OS-level reduced-motion preference is always respected."
          >
            <Switch
              checked={appearance.reducedMotion}
              onCheckedChange={(v) =>
                updateSettings({ appearance: { reducedMotion: v } })
              }
              className="data-[state=checked]:bg-jcyan data-[state=checked]:text-background"
            />
          </Row>
        </Panel>

        {/* Investigation defaults */}
        <Panel
          label={
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-jamber" />
              <p className="jaal-label">Investigation settings</p>
            </div>
          }
          bodyClassName="divide-y divide-jborder/40"
        >
          <Row
            title="Default scam category"
            description="Preselected in the new-investigation wizard."
          >
            <Select
              value={investigation.defaultCategory}
              onValueChange={(v) =>
                updateSettings({
                  investigation: { defaultCategory: v as ScamCategory },
                })
              }
            >
              <SelectTrigger className="h-8 w-52 border-jborder/70 bg-jsurface text-xs text-jtext focus:ring-jcyan/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-jborder/80 bg-popover text-jtext">
                {SCAM_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row
            title="Default detection mode"
            description="Safe simulation mode is recommended for the demo."
          >
            <Select
              value={investigation.defaultDetectionMode}
              onValueChange={(v) =>
                updateSettings({
                  investigation: { defaultDetectionMode: v as DetectionMode },
                })
              }
            >
              <SelectTrigger className="h-8 w-52 border-jborder/70 bg-jsurface text-xs text-jtext focus:ring-jcyan/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-jborder/80 bg-popover text-jtext">
                <SelectItem value="simulation">Simulation</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row
            title="Auto-extract identifiers"
            description="Pull UPI IDs, phones, URLs and payment amounts into evidence automatically."
          >
            <Switch
              checked={investigation.autoExtract}
              onCheckedChange={(v) =>
                updateSettings({ investigation: { autoExtract: v } })
              }
              className="data-[state=checked]:bg-jcyan data-[state=checked]:text-background"
            />
          </Row>
          <Row
            title="Auto-generate hashes"
            description="Record a SHA-256 hash for each new evidence item (Web Crypto)."
          >
            <Switch
              checked={investigation.autoHash}
              onCheckedChange={(v) =>
                updateSettings({ investigation: { autoHash: v } })
              }
              className="data-[state=checked]:bg-jcyan data-[state=checked]:text-background"
            />
          </Row>
        </Panel>

        {/* Simulation */}
        <Panel
          label={
            <div className="flex items-center gap-2">
              <Radio className="size-3.5 text-jred" />
              <p className="jaal-label">Simulation settings</p>
            </div>
          }
          bodyClassName="divide-y divide-jborder/40"
        >
          <Row
            title="Simulated activity"
            description="Ambient simulation events such as kill-chain stage notifications."
          >
            <Switch
              checked={simulation.simulatedActivity}
              onCheckedChange={(v) =>
                updateSettings({ simulation: { simulatedActivity: v } })
              }
              className="data-[state=checked]:bg-jcyan data-[state=checked]:text-background"
            />
          </Row>
          <Row
            title="Reset simulation"
            description="Clears one case's conversation, tactics and evidence back to its opening line."
          >
            <div className="flex items-center gap-2">
              <Select value={resetTarget} onValueChange={setResetTarget}>
                <SelectTrigger className="h-8 w-40 border-jborder/70 bg-jsurface font-mono text-[11px] text-jtext focus:ring-jcyan/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-jborder/80 bg-popover text-jtext">
                  {activeCases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!resetTarget}
                    className="h-8 cursor-pointer gap-1.5 border-jamber/50 font-mono text-[10px] uppercase tracking-wider text-jamber hover:bg-jamber/10 hover:text-jamber"
                  >
                    <RotateCcw className="size-3" /> Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-jborder/80 bg-popover">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-jtext">
                      Reset {resetTarget}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-jmuted">
                      Messages, tactics, evidence and logs for this case will be
                      discarded and re-seeded from the synthetic script.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer border-jborder/70 text-jmuted">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="cursor-pointer bg-jamber text-background hover:bg-jamber/85"
                      onClick={() => {
                        resetCase(resetTarget);
                        toast.warning(`${resetTarget} simulation reset`, {
                          duration: 1800,
                        });
                      }}
                    >
                      Reset case
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Row>
          <Row
            title="Reset demo data"
            description="Restores every seeded investigation, conversation, evidence item and clears generated reports."
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer gap-1.5 border-jred/50 font-mono text-[10px] uppercase tracking-wider text-jred hover:bg-jred/10 hover:text-jred"
                >
                  <Trash2 className="size-3" /> Reset demo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-jborder/80 bg-popover">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-jtext">
                    Reset all demo data?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-jmuted">
                    This restores the seeded JAAL-001…004 cases and removes any
                    cases and reports you created in this session.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer border-jborder/70 text-jmuted">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="cursor-pointer bg-jred text-background hover:bg-jred/85"
                    onClick={() => {
                      resetDemoData();
                      toast.warning("Demo data restored to seed state", {
                        duration: 2000,
                      });
                    }}
                  >
                    Reset everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
        </Panel>

        {/* Account */}
        <Panel
          label={
            <div className="flex items-center gap-2">
              <UserRound className="size-3.5 text-jteal" />
              <p className="jaal-label">Account</p>
            </div>
          }
          bodyClassName="divide-y divide-jborder/40"
        >
          <Row
            title="Display name"
            description={`Session email: ${state.user?.email ?? authUser?.email ?? "—"} · ${
              state.user ? "local simulation session" : "account session"
            }`}
          >
            <div className="flex items-center gap-2">
              <Input
                value={displayName}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-8 w-44 border-jborder/70 bg-jsurface text-xs text-jtext focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
              />
              <Button
                size="sm"
                onClick={handleSaveProfile}
                className="h-8 cursor-pointer gap-1.5 bg-jcyan font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jcyan/85"
              >
                <Save className="size-3" /> Save
              </Button>
            </div>
          </Row>
          <Row
            title="Sign out"
            description="Ends this session and returns to the landing page."
          >
            <Button
              size="sm"
              variant="outline"
              onClick={handleSignOut}
              className="h-8 cursor-pointer border-jred/50 font-mono text-[10px] uppercase tracking-wider text-jred hover:bg-jred/10 hover:text-jred"
            >
              Log out
            </Button>
          </Row>
        </Panel>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-jmuted/60">
        settings persist to local storage on this device
      </p>
    </div>
  );
}
