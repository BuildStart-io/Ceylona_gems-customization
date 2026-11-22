import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  MessageSquare,
  Gem,
  Gift,
  Sparkles,
  HelpCircle,
  Undo2,
  ListOrdered
} from "lucide-react";

export interface BudgetTier {
  label: string;
  min: number;
  max: number;
}

export interface FlowStepConfig {
  main_text: string;
  top_message?: string;
  bottom_message?: string;
}

export interface ChatFlowConfig {
  categories: {
    gemstones: {
      enabled: boolean;
      label: string;
      budget_tiers: BudgetTier[];
    };
    jewelry: {
      enabled: boolean;
      label: string;
      silver_setting_cost: number;
      budget_tiers: BudgetTier[];
    };
    packaging: {
      enabled: boolean;
      label: string;
    };
  };
  steps: Record<string, FlowStepConfig>;
  general_messages?: {
    confirmation_top_message?: string;
    confirmation_bottom_message?: string;
    handoff_message?: string;
  };
}

export const DEFAULT_FLOW_STEPS: Record<string, { label: string; desc: string; defaultText: string }> = {
  greeting: {
    label: "Step 1: Welcome Greeting & Category Poll Prompt",
    desc: "The very first message sent to new customers presenting the gift categories.",
    defaultText: "ආයුබෝවන්! 💎 Ceylona Gems & Jewelry වෙත සාදරයෙන් පිළිගන්නවා. අපි ඔයාට ලස්සනම gift එකක් තෝරගන්න උදව් කරන්නම්. ✨\n\nඔයා බලන්න කැමති මොන gift option එකද? පහළින් තෝරන්නකෝ 👇",
  },
  gem_budget: {
    label: "Step 2: Gemstone Budget Selection Prompt",
    desc: "Sent when customer chooses Gemstones, right above the budget poll options.",
    defaultText: "නියමයි! 💎 අපේ හැම gemstone එකකටම රජයේ ලියාපදිංචි Gem Lab Certificate එකක් ඇතුළත් කරලා තියෙන්නේ (LKR 1,500ක සහතිකයක් මිලටම ඇතුළත්). ✨\n\nඔයා බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇",
  },
  gem_color: {
    label: "Step 3: Gemstone Color / Type Preference Question",
    desc: "Asks customer which specific stone or color they prefer (e.g. Blue Sapphire, Ruby).",
    defaultText: "Budget එක සටහන් කරගත්තා! 💰💎\nඔබ විශේෂයෙන් සොයන Gemstone වර්ගයක් හෝ පාටක් (Color) තියෙනවද? (උදා: Blue Sapphire, Ruby, Yellow Sapphire, Amethyst, etc.)\nනැත්නම් 'ඕනෑම පාටක්' කියලා කියන්නත් පුළුවන් ✨",
  },
  gem_size: {
    label: "Step 4: Gemstone Size Selection Prompt",
    desc: "Asks customer to pick between Small (Small Gift), Medium (Ideal Gift or Ring), or Large (Gift / Pendant) size.",
    defaultText: "නියමයි! 💎 ඔයා බලාපොරොත්තු වෙන Gemstone Size එක පහළින් තෝරන්නකෝ 👇",
  },
  gem_recipient_date: {
    label: "Step 5: Gemstone Gift Recipient & Needed Date",
    desc: "Asks who the gift is for and what the target delivery date is.",
    defaultText: "හොඳයි! 💎 මේ gift එක කාටද දෙන්න බලාපොරොත්තු වෙන්නේ? (උදා: Birthday, Anniversary, Yourself) සහ මේක ඔබට කවදා වන විටද අවශ්‍ය වෙන්නේ? 🎁📅",
  },
  jewelry_type: {
    label: "Step 6: Silver Jewelry Type Selection Prompt",
    desc: "Sent when customer selects Silver Jewelry to pick Ring, Pendant, or Custom.",
    defaultText: "හරිම ලස්සන තේරීමක්! 💍✨ අපේ Silver Jewelry collection එක Solid 925 Silver වලින් master craftsmanship එකෙන් නිර්මාණය කරන්නේ (Handcrafted Silver pieces start from LKR 10,000+).\n\nඔයා කැමති jewelry වර්ගය පහළින් තෝරන්නකෝ 👇",
  },
  ring_size: {
    label: "Step 7: Ring Size Inquiry Prompt",
    desc: "Asks customer for their ring size or lets them know adjustable options exist.",
    defaultText: "Solid 925 Silver Rings! 💍✨ ඔයාගෙ Ring Size එක දන්නවද? (උදා: US 6, 7, 8 හෝ 'දන්නේ නෑ' කියලා කියන්න පුළුවන්) ✨",
  },
  jewelry_color: {
    label: "Step 8: Jewelry Gemstone & Color Preference Question",
    desc: "Asks customer for their preferred gemstone color to embed into the silver piece.",
    defaultText: "නියමයි! 💍 Jewelry එකට ඔබ කැමති Gemstone එකක් හෝ Color එකක් තියෙනවද? 💎 (උදා: Blue Sapphire, Ruby, Pink, White, etc.)",
  },
  jewelry_budget: {
    label: "Step 9: Silver Jewelry Budget Selection Prompt",
    desc: "Sent above the budget poll options for silver rings and pendants.",
    defaultText: "Silver Jewelry සඳහා ඔබ බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇",
  },
  jewelry_recipient_date: {
    label: "Step 10: Silver Jewelry Recipient & Needed Date",
    desc: "Asks who the jewelry is for and when it needs to be delivered.",
    defaultText: "හොඳයි! 💍 මේ gift එක කාටද දෙන්න බලාපොරොත්තු වෙන්නේ? (උදා: Birthday, Anniversary, Yourself) සහ මේක ඔබට කවදා වන විටද අවශ්‍ය වෙන්නේ? 🎁📅",
  },
  silver_disclaimer: {
    label: "Step 11: Silver Setting Cost & Design Disclaimer Note",
    desc: "Appears in jewelry recommendation message clarifying setting price variance.",
    defaultText: "ℹ️ *සැලකිය යුතුයි:* ඉහත දක්වා ඇත්තේ Gemstone එකෙහි මිල වන අතර, Silver Setting සඳහා design එක අනුව LKR {cost} ක පමණ මුදලක් vary විය හැක. ඔබ කැමති design එකට අදාළ සම්පූර්ණ අවසන් මිල අපේ sales agent ඔබ සමඟ confirm කරනු ඇත.",
  },
  packaging_select: {
    label: "Step 12: Gift Packaging Selection Prompt",
    desc: "Sent when customer selects Gift Packaging & Cards option.",
    defaultText: "අපි ළඟ තෑගි සඳහා විශේෂ Gift Packaging සහ Presentation options තියෙනවා: 🎁✨\n\nඔයා කැමති option එක පහළින් තෝරන්නකෝ 👇",
  },
  custom_design: {
    label: "Step 13: Custom Design Reference Photo Request",
    desc: "Sent when customer chooses 'Custom Design Piece' asking for reference photos.",
    defaultText: "Custom Goldsmithing & Bespoke Design! 💎 අපේ master jeweler ඔබ කැමති ඕනෑම design එකක් Solid 925 Silver වලින් සකස් කරලා දෙන්න සූදානම්. ඔයා ළඟ තියෙන photo එකක් හෝ reference design එකක් මේ chat එකට එවන්න පුළුවන්ද? අපේ designer කෙනෙක් ඉක්මනින්ම සම්බන්ධ වෙයි! ✨",
  },
  confirmation: {
    label: "Step 14: Final Order Summary & Confirmation Question",
    desc: "Prompt placed at the bottom of the order summary asking customer to confirm.",
    defaultText: "මේ විස්තර ඔක්කොම හරිද? Order එක confirm කරලා proceed කරන්නද? ✨",
  },
  agent_handoff: {
    label: "Step 15: Sales Consultant Handoff Closing Message",
    desc: "Final message sent to customer when order is confirmed informing that an agent will take over.",
    defaultText: "බොහොම ස්තූතියි! 💎 ඔයාගෙ requirements ඔක්කොම මම සටහන් කරගත්තා. අපේ sales specialist කෙනෙක් details confirm කරගන්න ඉක්මනින්ම මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨",
  },
  restart_flow: {
    label: "Step 16: Restart / Change Category Prompt",
    desc: "Prompt sent when customer taps 'Change' to pick categories from scratch.",
    defaultText: "කිසි ප්‍රශ්නයක් නෑ! 🔄 අපි නැවත මුල සිට තෝරාගනිමු. ඔයා කැමති category එක පහළින් තෝරන්නකෝ 👇",
  },
};

const DEFAULT_FLOW_CONFIG: ChatFlowConfig = {
  categories: {
    gemstones: {
      enabled: true,
      label: "💎 Gifting Gemstones",
      budget_tiers: [
        { label: "🔹 LKR 4,000 – 10,000", min: 4000, max: 10000 },
        { label: "🔹 LKR 10,000 – 20,000", min: 10000, max: 20000 },
        { label: "🔹 Above LKR 20,000", min: 20000, max: 999999 },
      ],
    },
    jewelry: {
      enabled: true,
      label: "💍 Silver Jewelry (Rings & Pendants)",
      silver_setting_cost: 5000,
      budget_tiers: [
        { label: "🔹 LKR 10,000 – 20,000", min: 10000, max: 20000 },
        { label: "🔹 LKR 20,000 – 35,000", min: 20000, max: 35000 },
        { label: "🔹 Above LKR 35,000", min: 35000, max: 999999 },
      ],
    },
    packaging: {
      enabled: true,
      label: "🎁 Gift Packaging & Cards",
    },
  },
  steps: Object.fromEntries(
    Object.entries(DEFAULT_FLOW_STEPS).map(([k, v]) => [
      k,
      { main_text: v.defaultText, top_message: "", bottom_message: "" },
    ])
  ),
  general_messages: {},
};

export default function ChatFlowSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ChatFlowConfig>(DEFAULT_FLOW_CONFIG);

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("user_id", user?.id)
        .eq("key", "chat_flow_config")
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading chat flow config:", error);
      }

      if (data?.value && typeof data.value === "object") {
        const val = data.value as any;

        // Build merged steps
        const mergedSteps: Record<string, FlowStepConfig> = {};
        for (const [stepKey, stepMeta] of Object.entries(DEFAULT_FLOW_STEPS)) {
          const userStep = val.steps?.[stepKey];
          mergedSteps[stepKey] = {
            main_text: userStep?.main_text !== undefined ? userStep.main_text : stepMeta.defaultText,
            top_message: userStep?.top_message || "",
            bottom_message: userStep?.bottom_message || "",
          };
        }

        setConfig({
          categories: {
            gemstones: {
              ...DEFAULT_FLOW_CONFIG.categories.gemstones,
              ...(val.categories?.gemstones || {}),
              budget_tiers: val.categories?.gemstones?.budget_tiers || DEFAULT_FLOW_CONFIG.categories.gemstones.budget_tiers,
            },
            jewelry: {
              ...DEFAULT_FLOW_CONFIG.categories.jewelry,
              ...(val.categories?.jewelry || {}),
              budget_tiers: val.categories?.jewelry?.budget_tiers || DEFAULT_FLOW_CONFIG.categories.jewelry.budget_tiers,
            },
            packaging: {
              ...DEFAULT_FLOW_CONFIG.categories.packaging,
              ...(val.categories?.packaging || {}),
            },
          },
          steps: mergedSteps,
          general_messages: {
            ...DEFAULT_FLOW_CONFIG.general_messages,
            ...(val.general_messages || {}),
          },
        });
      }
    } catch (e) {
      console.error("Failed to load chat flow config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("settings").upsert(
        {
          user_id: user.id,
          key: "chat_flow_config",
          value: config as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      );

      if (error) throw error;
      toast({
        title: "All Settings Saved Successfully",
        description: "Your questions, custom top/bottom messages, and budget tiers are now live.",
      });
    } catch (e: any) {
      console.error("Error saving chat flow config:", e);
      toast({
        title: "Error saving settings",
        description: e.message || "Failed to update chat flow config",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateStepField = (stepKey: string, field: "main_text" | "top_message" | "bottom_message", value: string) => {
    setConfig((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        [stepKey]: {
          ...(prev.steps[stepKey] || { main_text: "", top_message: "", bottom_message: "" }),
          [field]: value,
        },
      },
    }));
  };

  const resetStep = (stepKey: string) => {
    const meta = DEFAULT_FLOW_STEPS[stepKey];
    if (!meta) return;
    updateStepField(stepKey, "main_text", meta.defaultText);
    updateStepField(stepKey, "top_message", "");
    updateStepField(stepKey, "bottom_message", "");
    toast({
      title: "Step Reset",
      description: `Reset "${meta.label}" back to original default text. Remember to click Save.`,
    });
  };

  const addTier = (category: "gemstones" | "jewelry") => {
    const tiers = [...config.categories[category].budget_tiers];
    tiers.push({
      label: `🔹 Custom Tier ${tiers.length + 1}`,
      min: 10000,
      max: 20000,
    });
    setConfig({
      ...config,
      categories: {
        ...config.categories,
        [category]: {
          ...config.categories[category],
          budget_tiers: tiers,
        },
      },
    });
  };

  const removeTier = (category: "gemstones" | "jewelry", index: number) => {
    const tiers = config.categories[category].budget_tiers.filter((_, i) => i !== index);
    if (tiers.length === 0) {
      toast({ title: "Cannot delete all tiers", description: "You need at least 1 budget tier.", variant: "destructive" });
      return;
    }
    setConfig({
      ...config,
      categories: {
        ...config.categories,
        [category]: {
          ...config.categories[category],
          budget_tiers: tiers,
        },
      },
    });
  };

  const updateTier = (category: "gemstones" | "jewelry", index: number, field: "label" | "min" | "max", value: any) => {
    const tiers = [...config.categories[category].budget_tiers];
    const currentTier = tiers[index];

    let newLabel = field === "label" ? value : currentTier.label;
    const newMin = field === "min" ? (Number(value) || 0) : currentTier.min;
    const newMax = field === "max" ? (Number(value) || 0) : currentTier.max;

    // Automatically generate clean WhatsApp Poll label when Min or Max is edited
    if (field === "min" || field === "max") {
      if (newMax >= 99999 || newMax >= 999999) {
        newLabel = `🔹 Above LKR ${newMin.toLocaleString()}`;
      } else {
        newLabel = `🔹 LKR ${newMin.toLocaleString()} – ${newMax.toLocaleString()}`;
      }
    }

    tiers[index] = {
      ...currentTier,
      [field]: field === "label" ? value : Number(value) || 0,
      label: newLabel,
    };

    setConfig({
      ...config,
      categories: {
        ...config.categories,
        [category]: {
          ...config.categories[category],
          budget_tiers: tiers,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Groups of steps for visual clarity
  const stepGroups = [
    {
      groupTitle: "🌟 General Flow & Handoff Messages",
      steps: ["greeting", "confirmation", "agent_handoff", "restart_flow"],
    },
    {
      groupTitle: "💎 Gemstones Journey Steps",
      steps: ["gem_budget", "gem_color", "gem_size", "gem_recipient_date"],
    },
    {
      groupTitle: "💍 Silver Jewelry Journey Steps",
      steps: [
        "jewelry_type",
        "ring_size",
        "jewelry_color",
        "jewelry_budget",
        "jewelry_recipient_date",
        "silver_disclaimer",
        "custom_design",
      ],
    },
    {
      groupTitle: "🎁 Gift Packaging Steps",
      steps: ["packaging_select"],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top action header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-lg border">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Complete WhatsApp Flow & Message Customizer
          </h3>
          <p className="text-sm text-muted-foreground">
            Customize every question the bot asks, add top/bottom banners to each step, and manage budget tiers.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save All Flow Settings
        </Button>
      </div>

      {/* SECTION 1: Category Toggles & Budget Tiers */}
      <div className="space-y-4">
        <h4 className="text-md font-bold tracking-tight flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-primary" />
          1. Categories & Dynamic Budget Ranges
        </h4>

        {/* 1.1 Gemstones Category Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gem className="h-4 w-4 text-blue-500" />
                Category 1: Gifting Gemstones
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="gem-toggle" className="text-xs">
                  {config.categories.gemstones.enabled ? "Active" : "Disabled"}
                </Label>
                <Switch
                  id="gem-toggle"
                  checked={config.categories.gemstones.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      categories: {
                        ...config.categories,
                        gemstones: { ...config.categories.gemstones, enabled: checked },
                      },
                    })
                  }
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              Natural Sri Lankan gemstones flow settings and budget brackets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Category Button Label (in initial poll)</Label>
              <Input
                value={config.categories.gemstones.label}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    categories: {
                      ...config.categories,
                      gemstones: { ...config.categories.gemstones, label: e.target.value },
                    },
                  })
                }
              />
            </div>

            {/* Budget Tiers Editor */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Gemstone Budget Tiers</Label>
                <Button variant="outline" size="sm" onClick={() => addTier("gemstones")}>
                  <Plus className="h-3 w-3 mr-1" /> Add Tier
                </Button>
              </div>
              <div className="space-y-2">
                {config.categories.gemstones.budget_tiers.map((tier, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <div className="flex-1">
                      <Input
                        value={tier.label}
                        onChange={(e) => updateTier("gemstones", idx, "label", e.target.value)}
                        placeholder="Poll Label (e.g., 🔹 LKR 4,000 – 10,000)"
                      />
                    </div>
                    <div className="w-full sm:w-28 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Min:</span>
                      <Input
                        type="number"
                        value={tier.min}
                        onChange={(e) => updateTier("gemstones", idx, "min", e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-28 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Max:</span>
                      <Input
                        type="number"
                        value={tier.max}
                        onChange={(e) => updateTier("gemstones", idx, "max", e.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => removeTier("gemstones", idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 1.2 Silver Jewelry Category Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Category 2: Silver Jewelry (Rings & Pendants)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="jewelry-toggle" className="text-xs">
                  {config.categories.jewelry.enabled ? "Active" : "Disabled"}
                </Label>
                <Switch
                  id="jewelry-toggle"
                  checked={config.categories.jewelry.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      categories: {
                        ...config.categories,
                        jewelry: { ...config.categories.jewelry, enabled: checked },
                      },
                    })
                  }
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              Solid 925 Silver craft cost and budget ranges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Category Button Label</Label>
                <Input
                  value={config.categories.jewelry.label}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      categories: {
                        ...config.categories,
                        jewelry: { ...config.categories.jewelry, label: e.target.value },
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Approx Silver Setting Cost (LKR)</Label>
                <Input
                  type="number"
                  value={config.categories.jewelry.silver_setting_cost || 5000}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      categories: {
                        ...config.categories,
                        jewelry: {
                          ...config.categories.jewelry,
                          silver_setting_cost: Number(e.target.value) || 5000,
                        },
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* Budget Tiers Editor */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Silver Jewelry Budget Tiers</Label>
                <Button variant="outline" size="sm" onClick={() => addTier("jewelry")}>
                  <Plus className="h-3 w-3 mr-1" /> Add Tier
                </Button>
              </div>
              <div className="space-y-2">
                {config.categories.jewelry.budget_tiers.map((tier, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <div className="flex-1">
                      <Input
                        value={tier.label}
                        onChange={(e) => updateTier("jewelry", idx, "label", e.target.value)}
                        placeholder="Poll Label (e.g., 🔹 LKR 10,000 – 20,000)"
                      />
                    </div>
                    <div className="w-full sm:w-28 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Min:</span>
                      <Input
                        type="number"
                        value={tier.min}
                        onChange={(e) => updateTier("jewelry", idx, "min", e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-28 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Max:</span>
                      <Input
                        type="number"
                        value={tier.max}
                        onChange={(e) => updateTier("jewelry", idx, "max", e.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => removeTier("jewelry", idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 1.3 Gift Packaging Category Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4 text-purple-500" />
                Category 3: Gift Packaging & Cards
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="pkg-toggle" className="text-xs">
                  {config.categories.packaging.enabled ? "Active" : "Disabled (Hidden from bot)"}
                </Label>
                <Switch
                  id="pkg-toggle"
                  checked={config.categories.packaging.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      categories: {
                        ...config.categories,
                        packaging: { ...config.categories.packaging, enabled: checked },
                      },
                    })
                  }
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              Toggle this off to remove Gift Packaging from the initial options poll
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-xs">Category Button Label</Label>
              <Input
                value={config.categories.packaging.label}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    categories: {
                      ...config.categories,
                      packaging: { ...config.categories.packaging, label: e.target.value },
                    },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2: Step-by-Step Message & Question Customizer */}
      <div className="space-y-4">
        <div>
          <h4 className="text-md font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            2. Step-by-Step Question & Message Customizer
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Click on any step below to edit the exact question text, add a top promotional banner, or add a bottom disclaimer note.
          </p>
        </div>

        {stepGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-3 pt-2">
            <h5 className="font-semibold text-sm text-foreground/90">{group.groupTitle}</h5>

            <Accordion type="single" collapsible className="space-y-2">
              {group.steps.map((stepKey) => {
                const meta = DEFAULT_FLOW_STEPS[stepKey];
                const stepVal = config.steps[stepKey] || {
                  main_text: meta?.defaultText || "",
                  top_message: "",
                  bottom_message: "",
                };

                return (
                  <AccordionItem
                    key={stepKey}
                    value={stepKey}
                    className="border rounded-lg px-4 py-1 bg-card shadow-sm"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center text-left justify-between w-full pr-4 gap-2">
                        <div className="space-y-0.5">
                          <span className="font-medium text-sm block">{meta?.label || stepKey}</span>
                          <span className="text-xs text-muted-foreground block">{meta?.desc}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {stepVal.top_message && (
                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 border-blue-200">
                              Top Msg
                            </Badge>
                          )}
                          {stepVal.bottom_message && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                              Bottom Msg
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pt-2 space-y-4 border-t mt-2">
                      {/* 1. Top Message */}
                      <div className="space-y-1.5 bg-blue-50/40 p-3 rounded-md border border-blue-100">
                        <Label className="text-xs font-semibold text-blue-900 flex items-center justify-between">
                          <span>📢 Top Message (Optional Header / Announcement)</span>
                          <span className="text-[11px] font-normal text-muted-foreground">Appears above the question</span>
                        </Label>
                        <Textarea
                          rows={2}
                          value={stepVal.top_message || ""}
                          onChange={(e) => updateStepField(stepKey, "top_message", e.target.value)}
                          placeholder="e.g., ✨ Special offer: 10% discount on all certified stones this week!"
                          className="bg-white text-xs"
                        />
                      </div>

                      {/* 2. Main Question / Message */}
                      <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-md border">
                        <Label className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                          <span>💬 Main Question / Message Text</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Supports Sinhala, English, Tamil, emojis
                          </span>
                        </Label>
                        <Textarea
                          rows={3}
                          value={stepVal.main_text}
                          onChange={(e) => updateStepField(stepKey, "main_text", e.target.value)}
                          placeholder={meta?.defaultText}
                          className="bg-white text-xs"
                        />
                      </div>

                      {/* 3. Bottom Message */}
                      <div className="space-y-1.5 bg-amber-50/40 p-3 rounded-md border border-amber-100">
                        <Label className="text-xs font-semibold text-amber-900 flex items-center justify-between">
                          <span>ℹ️ Bottom Message (Optional Footer / Disclaimer Note)</span>
                          <span className="text-[11px] font-normal text-muted-foreground">Appears before buttons/poll</span>
                        </Label>
                        <Textarea
                          rows={2}
                          value={stepVal.bottom_message || ""}
                          onChange={(e) => updateStepField(stepKey, "bottom_message", e.target.value)}
                          placeholder="e.g., 🔒 Government lab certificate is included with your purchase."
                          className="bg-white text-xs"
                        />
                      </div>

                      {/* Reset button for this specific step */}
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => resetStep(stepKey)}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          Reset this step to default
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))}
      </div>

      {/* Save Button Footer */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={saving} className="px-6">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save All Flow Settings
        </Button>
      </div>
    </div>
  );
}
