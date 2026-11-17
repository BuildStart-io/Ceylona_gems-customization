import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface FlowPoll {
  name: string;
  options: string[];
  multipleAnswers?: boolean;
}

export interface FlowExecutionResult {
  handled: boolean;
  replyText?: string;
  poll?: FlowPoll;
  imageUrls?: string[];
  videoUrl?: string;
  isQualified?: boolean;
}

export interface LeadFlowState {
  current_step: string;
  category?: string;
  jewelry_type?: string;
  ring_size?: string;
  budget_tier?: string;
  budget_min?: number;
  budget_max?: number;
  gemstone_type?: string;
  color?: string;
  size?: string;
  gift_recipient?: string;
  required_date?: string;
  packaging_requested?: string;
  recommended_products?: any[];
  selected_product?: any;
  custom_request?: string;
  handed_off_at?: string;
}

// ----------------------------------------------------------------------------
// Natural Everyday Spoken Sinhala / Singlish Phrases & FAQs
// ----------------------------------------------------------------------------
const FAQ_KNOWLEDGE: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["price", "මිල", "gana", "cost", "range", "keeyada", "gaana"],
    answer: "අපි ළඟ gifting gemstones Rs. 4,400 ඉඳන් Rs. 150,000 දක්වා wide range එකක තියෙනවා. ✨ ඔබ තෝරාගන්නා gemstone එක සහ size එක අනුව මිල වෙනස් වෙනවා.",
  },
  {
    keywords: ["certificate", "සහතික", "sahathika", "card", "lab", "cert"],
    answer: "ඔව්, අපි ළඟ තියෙන හැම gemstone එකකටම Government-Registered Gem Lab Certificate එකක් ඇතුළත් කරලා තමයි ලබා දෙන්නේ (worth LKR 1,500 included in the price). 📜💎",
  },
  {
    keywords: ["delivery thiyanawada", "delivery thiyenawada", "delivery thiyeda", "islandwide delivery", "deliver karanawada", "deliver puluwanda", "delivery puluwanda", "delivery puluwan"],
    answer: "ඔව්, අපි Islandwide delivery (දිවයින පුරා බෙදාහැරීම) සිදු කරනවා. 🚚 Islandwide delivery fee එක Rs. 350ක් වෙනවා. දින 3–5ක් ඇතුළත safe courier මගින් delivery කරනු ලැබේ. ✨",
  },
  {
    keywords: ["cod", "cash on delivery", "delivery ekedi gewanna"],
    answer: "මේ වෙලාවේ COD temporarily pause කරලා තියෙන්නේ safe delivery quality එක ආරක්ෂා කරගන්න. 100% Bank Transfer මගින් payment කරන්න පුළුවන්. Delivery fee එක islandwide Rs. 350ක් වෙනවා. 🚚",
  },
  {
    keywords: ["location", "shop", "place", "where", "koheda", "store", "enna puluwanda", "visit"],
    answer: "අපි Wellampitiya වල based වෙලා ඉන්නේ online boutique එකක් විදිහට. දැනට direct safe courier delivery මගින් parcel එක ගෙදරටම ලබා දෙනවා. 📍✨",
  },
  {
    keywords: ["genuine", "real", "natural", "aththatama", "boruda", "original"],
    answer: "ඔව්, 100% genuine natural Sri Lankan gemstones පමණයි අපි ලබා දෙන්නේ. ඒ වගේම රජයේ ලියාපදිංචි gem lab certificate එකකුත් gemstone එකත් එක්කම ලැබෙනවා. 💎",
  },
  {
    keywords: ["delivery", "days", "kal", "dawas", "time", "reach", "kawadada labenne"],
    answer: "සාමාන්‍යයෙන් order එකක් prepare කරලා courier මගින් delivery වෙන්න දින 3–5ක් පමණ ගත වෙනවා. ඉක්මනින් අවශ්‍ය නම් අපේ sales agent කෙනෙක් assist කරයි. ⏳",
  },
];

// Helper to check for tangent question in-memory
function matchFaqQuestion(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const faq of FAQ_KNOWLEDGE) {
    if (faq.keywords.some((k) => lower.includes(k))) {
      return faq.answer;
    }
  }
  return null;
}

// Helper to query Ceylon_gems.faqs from database dynamically
async function findFaqInDb(supabase: SupabaseClient, userId: string, text: string): Promise<string | null> {
  try {
    const clean = text.toLowerCase().trim();
    if (clean.length < 3) return null;

    // Guard: If input is a delivery date and not explicitly asking about stones/birthstones
    const isPureDate = Boolean(extractDate(clean));
    const hasBirthstoneIntent = /birthstone|stone|gem|jewel|ගල|මොකක්ද|mokakda|which|what|උපන්/i.test(clean);

    // Guard: Do not run FAQ search on Category or Poll choices
    const isPollOption =
      clean.includes("gifting gemstone") ||
      clean.includes("silver jewelry") ||
      clean.includes("rings & pendants") ||
      clean.includes("gift packaging") ||
      clean.includes("solid 925 silver") ||
      clean.includes("custom design piece") ||
      clean.includes("budget range") ||
      clean.includes("size (delicate)") ||
      clean.includes("size (classic)") ||
      clean.includes("size (statement)") ||
      clean.includes("confirm කරන්න") ||
      clean.includes("වෙනස් කරන්න");

    if (isPollOption) return null;

    const { data: faqs } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!faqs || faqs.length === 0) return null;

    const stopWords = new Set(["the", "and", "are", "you", "for", "with", "this", "that", "how", "what", "does", "have", "can", "one", "all", "එක", "අපේ", "මේ", "නැද්ද", "තියෙනවද", "කීයද"]);

    for (const f of faqs) {
      const qLower = (f.question || "").toLowerCase();

      // Guard: Don't match birthstone FAQ on dates like "28th november"
      if ((qLower.includes("birthstone") || qLower.includes("stone")) && isPureDate && !hasBirthstoneIntent) {
        continue;
      }

      // Extract unique words of length >= 3
      const words = Array.from(new Set(
        qLower
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter(w => w.length >= 3 && !stopWords.has(w))
      ));

      const matches = words.filter(w => clean.includes(w));
      if (matches.length >= 2 || (words.length === 1 && matches.length === 1 && clean === words[0])) {
        return f.answer;
      }
    }
    return null;
  } catch (err) {
    console.warn("[FlowController] FAQ DB lookup error:", err);
    return null;
  }
}

// Extract date pattern
function extractDate(text: string): string | null {
  const match = text.match(/\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{2,4})?|\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?|\b(?:today|tomorrow|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)\b/i);
  return match ? match[0].trim() : null;
}

// Extract recipient pattern
function extractRecipient(text: string): string | null {
  const lower = text.toLowerCase();
  const recipientWords = [
    { word: "wife", label: "Wife" },
    { word: "husband", label: "Husband" },
    { word: "girlfriend", label: "Girlfriend" },
    { word: "boyfriend", label: "Boyfriend" },
    { word: "mother", label: "Mother" },
    { word: "amma", label: "Mother (Amma)" },
    { word: "father", label: "Father" },
    { word: "thaththa", label: "Father" },
    { word: "friend", label: "Friend" },
    { word: "yaluwek", label: "Friend" },
    { word: "myself", label: "Myself" },
    { word: "mata", label: "Myself" },
    { word: "me", label: "Myself" },
    { word: "sister", label: "Sister" },
    { word: "brother", label: "Brother" },
    { word: "daughter", label: "Daughter" },
    { word: "son", label: "Son" },
    { word: "fiance", label: "Fiancé" },
    { word: "special", label: "Special Someone" },
  ];
  for (const r of recipientWords) {
    if (new RegExp(`\\b${r.word}\\b`, "i").test(lower)) {
      return r.label;
    }
  }
  return null;
}

function isGenericFiller(text: string): boolean {
  const t = text.toLowerCase().trim();
  const generic = ["menu", "main menu", "hi", "hello", "hey", "ok", "k", "yes", "no", "thanks", "thank you", "test", "start", "reset", "help"];
  return generic.includes(t) || t.length < 2;
}

export interface BudgetTier {
  label: string;
  min: number;
  max: number;
}

export interface FlowStepConfig {
  main_text?: string;
  top_message?: string;
  bottom_message?: string;
}

export interface ChatFlowConfig {
  categories?: {
    gemstones?: {
      enabled?: boolean;
      label?: string;
      top_message?: string;
      bottom_message?: string;
      budget_tiers?: BudgetTier[];
    };
    jewelry?: {
      enabled?: boolean;
      label?: string;
      silver_setting_cost?: number;
      top_message?: string;
      bottom_message?: string;
      budget_tiers?: BudgetTier[];
    };
    packaging?: {
      enabled?: boolean;
      label?: string;
      top_message?: string;
      bottom_message?: string;
    };
  };
  steps?: {
    greeting?: FlowStepConfig;
    gem_budget?: FlowStepConfig;
    gem_color?: FlowStepConfig;
    gem_size?: FlowStepConfig;
    gem_recipient_date?: FlowStepConfig;
    jewelry_type?: FlowStepConfig;
    ring_size?: FlowStepConfig;
    jewelry_color?: FlowStepConfig;
    jewelry_budget?: FlowStepConfig;
    jewelry_recipient_date?: FlowStepConfig;
    silver_disclaimer?: FlowStepConfig;
    packaging_select?: FlowStepConfig;
    custom_design?: FlowStepConfig;
    confirmation?: FlowStepConfig;
    agent_handoff?: FlowStepConfig;
    restart_flow?: FlowStepConfig;
    [key: string]: FlowStepConfig | undefined;
  };
  general_messages?: {
    greeting_top_message?: string;
    greeting_bottom_message?: string;
    confirmation_top_message?: string;
    confirmation_bottom_message?: string;
    handoff_message?: string;
  };
}

export const DEFAULT_FLOW_STEPS: Record<string, FlowStepConfig> = {
  greeting: {
    main_text: "ආයුබෝවන්! 💎 Ceylona Gems & Jewelry වෙත සාදරයෙන් පිළිගන්නවා. අපි ඔයාට ලස්සනම gift එකක් තෝරගන්න උදව් කරන්නම්. ✨\n\nඔයා බලන්න කැමති මොන gift option එකද? පහළින් තෝරන්නකෝ 👇",
  },
  gem_budget: {
    main_text: "නියමයි! 💎 අපේ හැම gemstone එකකටම රජයේ ලියාපදිංචි Gem Lab Certificate එකක් ඇතුළත් කරලා තියෙන්නේ (LKR 1,500ක සහතිකයක් මිලටම ඇතුළත්). ✨\n\nඔයා බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇",
  },
  gem_color: {
    main_text: "Budget එක සටහන් කරගත්තා! 💰💎\nඔබ විශේෂයෙන් සොයන Gemstone වර්ගයක් හෝ පාටක් (Color) තියෙනවද? (උදා: Blue Sapphire, Ruby, Yellow Sapphire, Amethyst, etc.)\nනැත්නම් 'ඕනෑම පාටක්' කියලා කියන්නත් පුළුවන් ✨",
  },
  gem_size: {
    main_text: "නියමයි! 💎 ඔයා බලාපොරොත්තු වෙන Gemstone Size එක පහළින් තෝරන්නකෝ 👇",
  },
  gem_recipient_date: {
    main_text: "හොඳයි! 💎 මේ gift එක කාටද දෙන්න බලාපොරොත්තු වෙන්නේ? (උදා: Birthday, Anniversary, Yourself) සහ මේක ඔබට කවදා වන විටද අවශ්‍ය වෙන්නේ? 🎁📅",
  },
  jewelry_type: {
    main_text: "හරිම ලස්සන තේරීමක්! 💍✨ අපේ Silver Jewelry collection එක Solid 925 Silver වලින් master craftsmanship එකෙන් නිර්මාණය කරන්නේ (Handcrafted Silver pieces start from LKR 10,000+).\n\nඔයා කැමති jewelry වර්ගය පහළින් තෝරන්නකෝ 👇",
  },
  ring_size: {
    main_text: "Solid 925 Silver Rings! 💍✨ ඔයාගෙ Ring Size එක දන්නවද? (උදා: US 6, 7, 8 හෝ 'දන්නේ නෑ' කියලා කියන්න පුළුවන්) ✨",
  },
  jewelry_color: {
    main_text: "නියමයි! 💍 Jewelry එකට ඔබ කැමති Gemstone එකක් හෝ Color එකක් තියෙනවද? 💎 (උදා: Blue Sapphire, Ruby, Pink, White, etc.)",
  },
  jewelry_budget: {
    main_text: "Silver Jewelry සඳහා ඔබ බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇",
  },
  jewelry_recipient_date: {
    main_text: "හොඳයි! 💍 මේ gift එක කාටද දෙන්න බලාපොරොත්තු වෙන්නේ? (උදා: Birthday, Anniversary, Yourself) සහ මේක ඔබට කවදා වන විටද අවශ්‍ය වෙන්නේ? 🎁📅",
  },
  silver_disclaimer: {
    main_text: "ℹ️ *සැලකිය යුතුයි:* ඉහත දක්වා ඇත්තේ Gemstone එකෙහි මිල වන අතර, Silver Setting සඳහා design එක අනුව LKR {cost} ක පමණ මුදලක් vary විය හැක. ඔබ කැමති design එකට අදාළ සම්පූර්ණ අවසන් මිල අපේ sales agent ඔබ සමඟ confirm කරනු ඇත.",
  },
  packaging_select: {
    main_text: "අපි ළඟ තෑගි සඳහා විශේෂ Gift Packaging සහ Presentation options තියෙනවා: 🎁✨\n\nඔයා කැමති option එක පහළින් තෝරන්නකෝ 👇",
  },
  custom_design: {
    main_text: "Custom Goldsmithing & Bespoke Design! 💎 අපේ master jeweler ඔබ කැමති ඕනෑම design එකක් Solid 925 Silver වලින් සකස් කරලා දෙන්න සූදානම්. ඔයා ළඟ තියෙන photo එකක් හෝ reference design එකක් මේ chat එකට එවන්න පුළුවන්ද? අපේ designer කෙනෙක් ඉක්මනින්ම සම්බන්ධ වෙයි! ✨",
  },
  confirmation: {
    main_text: "මේ විස්තර ඔක්කොම හරිද? Order එක confirm කරලා proceed කරන්නද? ✨",
  },
  agent_handoff: {
    main_text: "බොහොම ස්තූතියි! 💎 ඔයාගෙ requirements ඔක්කොම මම සටහන් කරගත්තා. අපේ sales specialist කෙනෙක් details confirm කරගන්න ඉක්මනින්ම මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨",
  },
  restart_flow: {
    main_text: "කිසි ප්‍රශ්නයක් නෑ! 🔄 අපි නැවත මුල සිට තෝරාගනිමු. ඔයා කැමති category එක පහළින් තෝරන්නකෝ 👇",
  },
};

export const DEFAULT_FLOW_CONFIG: ChatFlowConfig = {
  categories: {
    gemstones: {
      enabled: true,
      label: "💎 Gifting Gemstones",
      budget_tiers: [
        { label: "🔹 LKR 4,000 – 10,000", min: 4000, max: 10000 },
        { label: "🔹 LKR 10,000 – 20,000", min: 10000, max: 20000 },
        { label: "🔹 Above LKR 20,000", min: 20000, max: 100000 },
      ],
    },
    jewelry: {
      enabled: true,
      label: "💍 Silver Jewelry (Rings & Pendants)",
      silver_setting_cost: 5000,
      budget_tiers: [
        { label: "🔹 LKR 10,000 – 20,000", min: 10000, max: 20000 },
        { label: "🔹 LKR 20,000 – 35,000", min: 20000, max: 35000 },
        { label: "🔹 Above LKR 35,000", min: 35000, max: 150000 },
      ],
    },
    packaging: {
      enabled: true,
      label: "🎁 Gift Packaging & Cards",
    },
  },
  steps: { ...DEFAULT_FLOW_STEPS },
};

export async function loadFlowConfig(supabase: SupabaseClient, userId: string): Promise<ChatFlowConfig> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "chat_flow_config")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.value && typeof data.value === "object") {
      const v = data.value as ChatFlowConfig;
      return {
        categories: {
          gemstones: { ...DEFAULT_FLOW_CONFIG.categories!.gemstones, ...v.categories?.gemstones },
          jewelry: { ...DEFAULT_FLOW_CONFIG.categories!.jewelry, ...v.categories?.jewelry },
          packaging: { ...DEFAULT_FLOW_CONFIG.categories!.packaging, ...v.categories?.packaging },
        },
        steps: {
          ...DEFAULT_FLOW_STEPS,
          ...(v.steps || {}),
        },
        general_messages: { ...v.general_messages },
      };
    }
  } catch (err) {
    console.warn("[FlowController] Error loading chat_flow_config:", err);
  }
  return {
    ...DEFAULT_FLOW_CONFIG,
    steps: { ...DEFAULT_FLOW_STEPS },
  };
}

export function getStepMessage(
  flowConfig: ChatFlowConfig,
  stepKey: string,
  placeholders?: Record<string, string | number>
): string {
  const stepCfg = flowConfig?.steps?.[stepKey];
  const defaultCfg = DEFAULT_FLOW_STEPS[stepKey];
  let text = stepCfg?.main_text?.trim() || defaultCfg?.main_text || "";
  if (placeholders) {
    for (const [k, v] of Object.entries(placeholders)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  const top = stepCfg?.top_message;
  const bottom = stepCfg?.bottom_message;
  return withTopBottom(text, top, bottom);
}

export function withTopBottom(text: string, top?: string, bottom?: string): string {
  const parts: string[] = [];
  if (top && top.trim().length > 0) parts.push(top.trim());
  parts.push(text.trim());
  if (bottom && bottom.trim().length > 0) parts.push(bottom.trim());
  return parts.join("\n\n");
}

export function getCategoryPollOptions(flowConfig: ChatFlowConfig): string[] {
  const options: string[] = [];
  if (flowConfig.categories?.gemstones?.enabled !== false) {
    options.push(flowConfig.categories?.gemstones?.label || "💎 Gifting Gemstones");
  }
  if (flowConfig.categories?.jewelry?.enabled !== false) {
    options.push(flowConfig.categories?.jewelry?.label || "💍 Silver Jewelry (Rings & Pendants)");
  }
  if (flowConfig.categories?.packaging?.enabled !== false) {
    options.push(flowConfig.categories?.packaging?.label || "🎁 Gift Packaging & Cards");
  }
  if (options.length === 0) {
    options.push("💎 Gifting Gemstones", "💍 Silver Jewelry (Rings & Pendants)");
  }
  return options;
}

export function matchBudgetTier(lower: string, tiers: BudgetTier[]): BudgetTier {
  if (!tiers || tiers.length === 0) {
    return { label: "Standard Budget", min: 10000, max: 20000 };
  }
  for (let i = 0; i < tiers.length; i++) {
    if (lower === String(i + 1) || lower.startsWith(`${i + 1}️⃣`) || lower.startsWith(String(i + 1))) {
      return tiers[i];
    }
  }
  for (const t of tiers) {
    if (lower.includes(t.label.toLowerCase())) {
      return t;
    }
  }
  if (lower.includes("above") || lower.includes("වැඩි") || lower.includes("over")) {
    return tiers[tiers.length - 1];
  }
  for (const t of tiers) {
    if (lower.includes(String(t.min)) || (t.max < 100000 && lower.includes(String(t.max)))) {
      return t;
    }
  }
  return tiers[0];
}

export function getNotificationRecipients(notifSettings: any): string[] {
  const val = notifSettings?.value || {};
  const candidates = [
    val.phone,
    val.phone_2,
    val.phone_3,
    ...(Array.isArray(val.additional_phones) ? val.additional_phones : []),
    ...(Array.isArray(val.phones) ? val.phones : []),
  ];
  return candidates
    .map((p) => String(p || "").replace(/\D/g, ""))
    .filter((p, idx, arr) => p.length >= 9 && arr.indexOf(p) === idx);
}

export async function sendLeadNotifications(
  supabase: SupabaseClient,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  notifMessage: string,
  sessionApiKey: string
) {
  try {
    const { data: notifSettings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "order_notifications")
      .eq("user_id", userId)
      .maybeSingle();

    const recipients = getNotificationRecipients(notifSettings);
    console.log(`[FlowController] Dispatching notifications to ${recipients.length} recipients:`, recipients);

    for (const phone of recipients) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-Ceylon_gems`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phone,
            message: notifMessage,
            sessionApiKey,
          }),
        });
      } catch (err) {
        console.warn(`[FlowController] Failed to send notification to ${phone}:`, err);
      }
    }
  } catch (err) {
    console.warn("[FlowController] Notification fetch error:", err);
  }
}

export async function handleQualificationFlow(
  supabase: SupabaseClient,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  phoneNumber: string,
  senderName: string,
  messageText: string,
  messageType: string,
  sessionApiKey: string
): Promise<FlowExecutionResult> {
  const cleanText = (messageText || "").trim();
  const lower = cleanText.toLowerCase();

  // Load dynamic flow configuration from Ceylon_gems.settings
  const flowConfig = await loadFlowConfig(supabase, userId);

  // 1. Fetch current lead state from Ceylon_gems.leads
  const { data: leadRow } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  const isAlreadyQualified = leadRow?.status === "qualified" || leadRow?.custom_fields?.is_qualified === true;

  let state: LeadFlowState = (leadRow?.custom_fields?.flow_state as LeadFlowState) || {
    current_step: isAlreadyQualified ? "HANDED_OFF" : "START",
  };

  // If customer is already qualified, keep them in HANDED_OFF unless they explicitly ask to reset
  if (isAlreadyQualified && (!state.current_step || state.current_step === "START")) {
    state.current_step = "HANDED_OFF";
  }

  console.log(`[FlowController] Phone: ${phoneNumber} | Step: ${state.current_step} | Input: "${cleanText}" (type: ${messageType})`);

  // Check if explicit reset/restart is requested (e.g. "start", "reset", "begin", "menu", "මුල සිට")
  const isExplicitReset = /^(start|begin|restart|reset|menu|main menu|home|options|මුල සිට|අලුත්|ආපසු|new order|new gift|මෙනු|மீண்டும்|ஆரம்பம்)$/i.test(lower);
  // General greetings reset to START if lead is NOT already qualified
  const isGreeting = /^(hi|hello|hey|hlw|hlo|halo|gm|gn|good morning|good evening|ආයුබෝවන්|සාදරයෙන්|வணக்கம்|ஹலோ)$/i.test(lower);

  if (isExplicitReset || (isGreeting && !isAlreadyQualified)) {
    state = { current_step: "START" };
  }

  // --------------------------------------------------------------------------
  // POST-HANDOFF STATE: LEAD IS ALREADY QUALIFIED
  // --------------------------------------------------------------------------
  if (state.current_step === "HANDED_OFF" || state.current_step === "QUALIFIED_COMPLETE") {
    // Check how long ago the order handoff occurred
    const handedOffAtStr = state.handed_off_at || leadRow?.updated_at || leadRow?.created_at;
    const elapsedMinutes = handedOffAtStr
      ? (Date.now() - new Date(handedOffAtStr).getTime()) / (1000 * 60)
      : 999999;
    const isNewSession = elapsedMinutes > 180; // More than 3 hours ago (e.g. next day or later that evening)

    // Check if customer wants another item (natural language Sinhala / English / Tamil)
    const wantsAnother = /thawa|another|wena|one more|next gift|new gift|තව|වෙන|இன்னொரு|வேற|மற்றுமொரு/i.test(lower);

    // Check if customer directly typed or voted a product category
    const isDirectCategory = lower.includes("gemstone") || lower.includes("jewelry") || lower.includes("silver") || lower.includes("ring") || lower.includes("pendant") || lower.includes("packaging") || lower.includes("මැණික්") || lower.includes("රිදී");

    // A) If returning on next day / after 3+ hours and saying "Hi" / greeting:
    // B) Or if customer says "thawa ekak ona" / "another one" / "new order" at any time:
    // C) Or if customer explicitly resets:
    if (isExplicitReset || wantsAnother || (isNewSession && isGreeting)) {
      state = { current_step: "CATEGORY_SELECT" };
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      const welcomeBackMsg = isNewSession
        ? "ආයුබෝවන් නැවතත්! 💎 Ceylona Gems & Jewelry වෙත සාදරයෙන් පිළිගන්නවා. අදත් ඔයාට ලස්සනම gift එකක් තෝරගන්න උදව් කරන්නම්. ✨\n\nඔයා බලන්න කැමති මොන gift option එකද? පහළින් තෝරන්නකෝ 👇"
        : "නියමයි! 💎 අපි තවත් ලස්සන gift එකක් තෝරගමු. ✨\n\nඔයා බලන්න කැමති මොන gift option එකද? පහළින් තෝරන්නකෝ 👇";

      return {
        handled: true,
        replyText: welcomeBackMsg,
        poll: {
          name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
          options: getCategoryPollOptions(flowConfig),
          multipleAnswers: false,
        },
      };
    }

    // D) If customer directly mentions a category (e.g., "gemstone" or "ring"):
    if (isDirectCategory) {
      state = { current_step: "START" };
      // Fall through to step 0 / category selection
    } else {
      // 1. Check for FAQ question (Delivery, COD, Bank details, Location, etc.)
      const postFaq = matchFaqQuestion(cleanText) || await findFaqInDb(supabase, userId, cleanText);
      if (postFaq) {
        return {
          handled: true,
          replyText: `${postFaq}\n\nඅපේ sales specialist කෙනෙක් තව සුළු වෙලාවකින් මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨`,
        };
      }

      // 2. Check for thank you / polite closing
      const isThanks = /^(thanks?|thank you|thx|ok|okay|hari|elakiri|හරි|ස්තූතියි|බොහොම ස්තූතියි|நன்றி|சரி)$/i.test(lower) || lower.includes("thank") || lower.includes("ස්තූති");
      if (isThanks) {
        return {
          handled: true,
          replyText: "ඔයාටත් බොහොම ස්තූතියි! 💎 අපේ sales specialist කෙනෙක් විස්තර confirm කරගන්න ඉක්මනින්ම ඔයාව සම්බන්ධ කරගනීවි. සුභ දවසක්! ✨",
        };
      }

      // 3. Customer says "Hi" / "Hello" within active order window (< 3 hours since order):
      if (isGreeting) {
        return {
          handled: true,
          replyText: "ආයුබෝවන්! 💎 ඔයා කලින් confirm කරපු order එකේ විස්තර අපේ sales specialist සටහන් කරගෙන තියෙන්නේ. ඉක්මනින්ම ඔයාව සම්බන්ධ කරගනීවි. ✨\n\nඅලුතින් තවත් gift එකක් තෝරාගන්න අවශ්‍ය නම්, පහළින් option එකක් තෝරන්නකෝ 👇",
          poll: {
            name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
            options: getCategoryPollOptions(flowConfig),
            multipleAnswers: false,
          },
        };
      }

      // 4. For any other inquiry, let AI or human agent assist without resetting flow
      return { handled: false };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 0: START / WELCOME
  // --------------------------------------------------------------------------
  if (state.current_step === "START") {
    state.current_step = "CATEGORY_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    // If customer asked an FAQ right at the start, answer it along with the gift categories poll
    const initialFaq = matchFaqQuestion(cleanText) || await findFaqInDb(supabase, userId, cleanText);
    const greetingMsg = getStepMessage(flowConfig, "greeting");
    const greetingText = initialFaq ? `${initialFaq}\n\n${greetingMsg}` : greetingMsg;

    return {
      handled: true,
      replyText: greetingText,
      poll: {
        name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
        options: getCategoryPollOptions(flowConfig),
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // GLOBAL CATEGORY SWITCH GUARD (WhatsApp Poll One-Touch & Category Change)
  // --------------------------------------------------------------------------
  // If the user taps a Category poll option or requests a Category at ANY time,
  // immediately transition cleanly to that Category flow, wiping any stale cross-category fields.
  const currentCategoryPollOptions = getCategoryPollOptions(flowConfig);

  const isGiftingGemstonesVote =
    lower.includes("gifting gemstone") ||
    lower === "💎 gifting gemstones" ||
    (state.current_step === "CATEGORY_SELECT" && (lower.includes("gemstone") || lower.includes("මැණික්") || (currentCategoryPollOptions[0] && lower === "1" && currentCategoryPollOptions[0].toLowerCase().includes("gemstone"))));

  const isSilverJewelryVote =
    lower.includes("silver jewelry") ||
    lower.includes("rings & pendants") ||
    lower === "💍 silver jewelry (rings & pendants)" ||
    (state.category === "Gifting Gemstone" && (lower.includes("silver") || lower.includes("ring") || lower.includes("pendant") || lower.includes("රිදී"))) ||
    (state.current_step === "CATEGORY_SELECT" && (lower.includes("jewelry") || lower.includes("silver") || lower.includes("රිදී") || lower.includes("ring") || lower.includes("pendant") || (currentCategoryPollOptions.findIndex(o => o.toLowerCase().includes("jewelry") || o.toLowerCase().includes("silver")) !== -1 && lower === String(currentCategoryPollOptions.findIndex(o => o.toLowerCase().includes("jewelry") || o.toLowerCase().includes("silver")) + 1))));

  const isGiftPackagingVote =
    lower.includes("gift packaging") ||
    lower.includes("packaging & cards") ||
    lower === "🎁 gift packaging & cards" ||
    (state.current_step === "CATEGORY_SELECT" && (lower.includes("packaging") || lower.includes("box") || lower.includes("card") || (currentCategoryPollOptions.findIndex(o => o.toLowerCase().includes("packaging")) !== -1 && lower === String(currentCategoryPollOptions.findIndex(o => o.toLowerCase().includes("packaging")) + 1))));

  if (isGiftingGemstonesVote && flowConfig.categories?.gemstones?.enabled !== false) {
    state = {
      category: "Gifting Gemstone",
      current_step: "GEM_BUDGET_SELECT",
    };
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const gemTiers = (flowConfig.categories?.gemstones?.budget_tiers && flowConfig.categories.gemstones.budget_tiers.length > 0)
      ? flowConfig.categories.gemstones.budget_tiers
      : DEFAULT_FLOW_CONFIG.categories!.gemstones!.budget_tiers!;

    const replyMsg = getStepMessage(flowConfig, "gem_budget");

    return {
      handled: true,
      replyText: replyMsg,
      poll: {
        name: "💰 Gemstone සඳහා Budget Range එක තෝරන්න:",
        options: gemTiers.map((t) => t.label),
        multipleAnswers: false,
      },
    };
  }

  if (isSilverJewelryVote && flowConfig.categories?.jewelry?.enabled !== false) {
    state = {
      category: "Silver Jewelry",
      current_step: "JEWELRY_TYPE_SELECT",
    };
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const replyMsg = getStepMessage(flowConfig, "jewelry_type");

    return {
      handled: true,
      replyText: replyMsg,
      poll: {
        name: "💍 Silver Jewelry වර්ගය තෝරන්න:",
        options: [
          "1️⃣ Solid 925 Silver Ring",
          "2️⃣ Solid 925 Silver Pendant",
          "3️⃣ Custom Design Piece",
        ],
        multipleAnswers: false,
      },
    };
  }

  if (isGiftPackagingVote && flowConfig.categories?.packaging?.enabled !== false) {
    state = {
      category: "Gift Packaging",
      current_step: "PACKAGING_SELECT",
    };
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const replyMsg = getStepMessage(flowConfig, "packaging_select");

    return {
      handled: true,
      replyText: replyMsg,
      poll: {
        name: "📦 Packaging Option එක තෝරන්න:",
        options: [
          "1️⃣ Decorative Gift Box",
          "2️⃣ Gem Presentation Box",
          "3️⃣ Standard Free Packaging",
          "4️⃣ Letter Card / Message Card",
          "5️⃣ Custom Packaging Request",
        ],
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // GLOBAL JEWELRY TYPE SWITCH GUARD (One-touch poll reaction inside Silver Jewelry)
  // --------------------------------------------------------------------------
  const isRingTypeVote =
    lower.includes("solid 925 silver ring") ||
    (state.category === "Silver Jewelry" && state.current_step === "JEWELRY_TYPE_SELECT" && (lower.includes("ring") || lower.includes("මුද්ද") || lower === "1"));

  const isPendantTypeVote =
    lower.includes("solid 925 silver pendant") ||
    (state.category === "Silver Jewelry" && state.current_step === "JEWELRY_TYPE_SELECT" && (lower.includes("pendant") || lower.includes("පෙන්ඩන්ට්") || lower === "2"));

  const isCustomDesignTypeVote =
    lower.includes("custom design piece") ||
    (state.category === "Silver Jewelry" && state.current_step === "JEWELRY_TYPE_SELECT" && (lower.includes("custom") || lower.includes("bespoke") || lower.includes("design") || lower.includes("විශේෂ") || lower === "3"));

  if (isRingTypeVote) {
    state.category = "Silver Jewelry";
    state.jewelry_type = "Silver Ring";
    state.current_step = "RING_SIZE_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "Solid 925 Silver Rings! 💍 ඔයාගෙ Ring Size එක දන්නවද? (උදා: US 5, 6, 7, 8, 9, 10, 11 හෝ දන්නේ නැත්නම් 'දන්නේ නෑ' කියලා කියන්න පුළුවන්) ✨",
    };
  }

  if (isPendantTypeVote) {
    state.category = "Silver Jewelry";
    state.jewelry_type = "Silver Pendant";
    delete state.ring_size;
    state.current_step = "JEWELRY_BUDGET_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "Solid 925 Silver Pendants! ✨ Silver Jewelry සඳහා ඔබ බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇",
      poll: {
        name: "💰 Silver Jewelry Budget Range:",
        options: [
          "🔹 LKR 10,000 – 20,000",
          "🔹 LKR 20,000 – 35,000",
          "🔹 Above LKR 35,000",
        ],
        multipleAnswers: false,
      },
    };
  }

  if (isCustomDesignTypeVote) {
    state.category = "Silver Jewelry";
    state.jewelry_type = "Custom Design";
    state.current_step = "CUSTOM_HANDOFF";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "Custom Goldsmithing & Bespoke Design! 💎 අපේ master jeweler කෙනෙක් ඔයාගෙ design එක සහ gemstone mounting ගැන කතා කරන්න සූදානම්. ඔයා බලාපොරොත්තු වෙන design එක සහ budget එක කෙටියෙන් සඳහන් කරන්නකෝ. ✨",
    };
  }

  // --------------------------------------------------------------------------
  // CHECK FOR OUT-OF-FLOW TANGENT / FAQ INQUIRY
  // --------------------------------------------------------------------------
  // If the user's message is clearly a question (e.g., COD, Location, Price general, Certificate)
  // and doesn't match the current step's expected action, we answer and immediately resume the step!
  const isDirectStepChoice = isStepMatchingInput(state.current_step, cleanText);
  const faqAnswer = !isDirectStepChoice ? (matchFaqQuestion(cleanText) || await findFaqInDb(supabase, userId, cleanText)) : null;

  if (faqAnswer && !isDirectStepChoice) {
    console.log(`[FlowController] Tangent detected at step ${state.current_step}: "${cleanText}"`);
    const resumePrompt = getResumePromptForStep(state, flowConfig);
    return {
      handled: true,
      replyText: `${faqAnswer}\n\n${resumePrompt.text}`,
      poll: resumePrompt.poll,
    };
  }

  // --------------------------------------------------------------------------
  // STEP 1: CATEGORY SELECTION (Fallback for unrecognized input)
  // --------------------------------------------------------------------------
  if (state.current_step === "CATEGORY_SELECT") {
    const greetingMsg = getStepMessage(flowConfig, "greeting");
    return {
      handled: true,
      replyText: greetingMsg || "ඔයාට gift එකක් විදිහට තෝරාගන්න කැමති category එක පහළින් තෝරන්නකෝ 👇",
      poll: {
        name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
        options: getCategoryPollOptions(flowConfig),
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // CATEGORY 1: GIFTING GEMSTONE FLOW
  // --------------------------------------------------------------------------
  if (state.current_step === "GEM_BUDGET_SELECT") {
    const gemTiers = (flowConfig.categories?.gemstones?.budget_tiers && flowConfig.categories.gemstones.budget_tiers.length > 0)
      ? flowConfig.categories.gemstones.budget_tiers
      : DEFAULT_FLOW_CONFIG.categories!.gemstones!.budget_tiers!;

    const matched = matchBudgetTier(lower, gemTiers);
    state.budget_tier = matched.label;
    state.budget_min = matched.min;
    state.budget_max = matched.max;

    state.current_step = "GEM_COLOR_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: getStepMessage(flowConfig, "gem_color"),
    };
  }

  if (state.current_step === "GEM_COLOR_SELECT") {
    if (!isGenericFiller(cleanText)) {
      state.color = cleanText;
      state.gemstone_type = cleanText;
    }
    state.current_step = "GEM_SIZE_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    // Check if the requested color/stone matches catalog
    const colorLower = cleanText.toLowerCase();
    const availableColors = ["blue", "pink", "yellow", "red", "green", "purple", "pushparaga", "ruby", "sapphire", "amethyst", "garnet", "tsavorite", "නිල්", "රතු", "කහ", "රෝස", "දම්", "පච්ච"];
    const isColorAvailable = availableColors.some(c => colorLower.includes(c));

    const colorNote = (!isColorAvailable && colorLower !== "any" && colorLower !== "kisi" && colorLower !== "ona ekak" && colorLower !== "all" && !isGenericFiller(cleanText))
      ? `(${cleanText} natural gems stock එකේ නැති වුණත්, අපේ popular Royal Blue, Baby Pink, Ruby Red, Golden Yellow sapphire සහ Purple Amethyst වලින් හොඳම gemstone එකක් තෝරගන්න පුළුවන් ✨)\n\n`
      : "";

    const sizePrompt = getStepMessage(flowConfig, "gem_size");
    return {
      handled: true,
      replyText: colorNote ? `${colorNote}${sizePrompt}` : sizePrompt,
      poll: {
        name: "📏 Gemstone එකේ Size එක තෝරන්න:",
        options: [
          "🔹 Small Size (Delicate)",
          "🔹 Medium Size (Classic)",
          "🔹 Large Size (Statement)",
          "🔹 Custom Luxury Size",
        ],
        multipleAnswers: false,
      },
    };
  }

  if (state.current_step === "GEM_SIZE_SELECT") {
    let chosenSize = "Medium Size";
    if (lower.includes("small") || lower.includes("1")) chosenSize = "Small Size";
    else if (lower.includes("large") || lower.includes("3")) chosenSize = "Large Size";
    else if (lower.includes("custom") || lower.includes("luxury") || lower.includes("4")) chosenSize = "Custom Luxury Size";

    state.size = chosenSize;
    state.current_step = "GEM_RECIPIENT_AND_DATE";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: getStepMessage(flowConfig, "gem_recipient_date"),
    };
  }

  if (state.current_step === "GEM_RECIPIENT_AND_DATE") {
    const foundDate = extractDate(cleanText);
    const foundRecipient = extractRecipient(cleanText);

    if (foundDate && !state.required_date) state.required_date = foundDate;
    if (foundRecipient && !state.gift_recipient) state.gift_recipient = foundRecipient;

    // Only assign raw cleanText if NEITHER date nor recipient regex matched anything and not a generic filler
    if (!foundDate && !foundRecipient) {
      if (!isGenericFiller(cleanText)) {
        if (!state.gift_recipient) {
          state.gift_recipient = cleanText;
        } else if (!state.required_date) {
          state.required_date = cleanText;
        }
      }
    }

    // Still missing delivery date? Ask for it specifically!
    if (state.gift_recipient && !state.required_date) {
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 🎁 මේ gift එක කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ කියලා target date එකක් කියන්න පුළුවන්ද? 📅",
      };
    }

    // Still missing recipient? Ask for it specifically!
    if (!state.gift_recipient && state.required_date) {
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 📅 මේ gift එක කාටද දෙන්න හිතන් ඉන්නේ කියලා කියන්න පුළුවන්ද? 🎁",
      };
    }

    // Fallback if neither was set
    if (!state.gift_recipient && !state.required_date) {
      state.gift_recipient = cleanText;
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 🎁 මේ gift එක කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ කියලා target date එකක් කියන්න පුළුවන්ද? 📅",
      };
    }

    // Both recipient and date are now collected! Save state immediately so we never loop.
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    // Recommend products from the 20 configured products.
    const recommendations = await fetchConfiguredRecommendations(supabase, userId, "Gifting Gemstone", state.budget_min || 4000, state.budget_max || 20000, state.color || "");

    state.recommended_products = recommendations;
    state.current_step = "PRODUCT_SELECTION";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const recLines = recommendations.map((p, idx) => {
      return `${idx + 1}️⃣ *${p.name}*\n💰 Base Price: LKR ${p.price?.toLocaleString()}\n📜 Government-Registered Gem Lab Certificate Included\n`;
    }).join("\n");

    const imageUrls = recommendations.flatMap((p) => p.images || []).slice(0, 2);

    const baseReply = `✨ ඔයාගෙ requirements වලට ගැළපෙන අපේ හොඳම Gemstones මෙන්න:\n\n${recLines}\nමේ options වලින් ඔයා වඩාත්ම කැමති piece එක පහළින් තෝරන්නකෝ 👇`;
    const replyText = withTopBottom(baseReply, flowConfig.categories?.gemstones?.top_message, flowConfig.categories?.gemstones?.bottom_message);

    return {
      handled: true,
      replyText,
      poll: {
        name: "💎 ඔබ වඩාත්ම කැමති Gemstone එක තෝරන්න:",
        options: recommendations.map((p, idx) => `${idx + 1}️⃣ ${p.name.substring(0, 25)}`),
        multipleAnswers: false,
      },
      imageUrls,
    };
  }

  // --------------------------------------------------------------------------
  // CATEGORY 2: SILVER JEWELRY FLOW
  // --------------------------------------------------------------------------
  if (state.current_step === "JEWELRY_TYPE_SELECT") {
    if (lower.includes("ring") || lower.includes("මුද්ද") || lower.includes("1")) {
      state.jewelry_type = "Silver Ring";
      state.current_step = "RING_SIZE_SELECT";
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      return {
        handled: true,
        replyText: getStepMessage(flowConfig, "ring_size"),
      };
    } else if (lower.includes("pendant") || lower.includes("පෙන්ඩන්ට්") || lower.includes("2")) {
      state.jewelry_type = "Silver Pendant";
      state.current_step = "JEWELRY_BUDGET_SELECT";
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      const jewelryTiers = (flowConfig.categories?.jewelry?.budget_tiers && flowConfig.categories.jewelry.budget_tiers.length > 0)
        ? flowConfig.categories.jewelry.budget_tiers
        : DEFAULT_FLOW_CONFIG.categories!.jewelry!.budget_tiers!;

      const replyMsg = getStepMessage(flowConfig, "jewelry_budget");

      return {
        handled: true,
        replyText: replyMsg,
        poll: {
          name: "💰 Silver Jewelry Budget Range:",
          options: jewelryTiers.map((t) => t.label),
          multipleAnswers: false,
        },
      };
    } else if (lower.includes("custom") || lower.includes("bespoke") || lower.includes("3") || lower.includes("design") || lower.includes("විශේෂ")) {
      // Custom Goldsmithing Hand-off
      state.jewelry_type = "Custom Design";
      state.current_step = "CUSTOM_HANDOFF";
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      return {
        handled: true,
        replyText: getStepMessage(flowConfig, "custom_design"),
      };
    } else {
      return {
        handled: true,
        replyText: getStepMessage(flowConfig, "jewelry_type"),
        poll: {
          name: "💍 Silver Jewelry වර්ගය තෝරන්න:",
          options: [
            "1️⃣ Solid 925 Silver Ring",
            "2️⃣ Solid 925 Silver Pendant",
            "3️⃣ Custom Design Piece",
          ],
          multipleAnswers: false,
        },
      };
    }
  }

  if (state.current_step === "CUSTOM_HANDOFF") {
    state.current_step = "QUALIFIED_COMPLETE";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const notifMessage = `🌟 *NEW CUSTOM DESIGN LEAD — Ceylona Gems!*\n\n👤 *Customer:* ${senderName || "Customer"}\n📱 *Phone:* ${phoneNumber}\n💎 *Category:* Custom Goldsmithing / Bespoke\n📝 *Details:* ${cleanText}\n\n👉 *Reply on WhatsApp to assist with custom design!*`;
    await sendLeadNotifications(supabase, supabaseUrl, supabaseServiceKey, userId, notifMessage, sessionApiKey);

    return {
      handled: true,
      replyText: getStepMessage(flowConfig, "agent_handoff"),
      isQualified: true,
    };
  }

  if (state.current_step === "RING_SIZE_SELECT") {
    const isUnknownSize =
      lower.includes("don't know") ||
      lower.includes("dont know") ||
      lower.includes("not sure") ||
      lower.includes("danna na") ||
      lower.includes("dannaha") ||
      lower.includes("දන්නේ නෑ") ||
      lower.includes("දන්නේ නැහැ") ||
      lower.includes("no idea");

    if (isUnknownSize) {
      state.ring_size = "Standard Adjustable / Consultation with Agent";
    } else {
      state.ring_size = cleanText;
    }

    state.current_step = "JEWELRY_BUDGET_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const jewelryTiers = (flowConfig.categories?.jewelry?.budget_tiers && flowConfig.categories.jewelry.budget_tiers.length > 0)
      ? flowConfig.categories.jewelry.budget_tiers
      : DEFAULT_FLOW_CONFIG.categories!.jewelry!.budget_tiers!;

    const sizeNote = isUnknownSize
      ? "කිසිම ප්‍රශ්නයක් නෑ! 💍 අපේ silver rings standard adjustable sizes වලිනුත් ලබාගන්න පුළුවන්, ඒ වගේම අපේ specialist ඔයාට ring size එක මැනගන්න guide එකක් ලබාදෙයි. ✨\n\n"
      : `Ring Size: ${cleanText} සටහන් කරගත්තා! 💍\n\n`;

    const budgetMsg = getStepMessage(flowConfig, "jewelry_budget");

    return {
      handled: true,
      replyText: `${sizeNote}${budgetMsg}`,
      poll: {
        name: "💰 Silver Jewelry Budget Range:",
        options: jewelryTiers.map((t) => t.label),
        multipleAnswers: false,
      },
    };
  }

  if (state.current_step === "JEWELRY_BUDGET_SELECT") {
    const jewelryTiers = (flowConfig.categories?.jewelry?.budget_tiers && flowConfig.categories.jewelry.budget_tiers.length > 0)
      ? flowConfig.categories.jewelry.budget_tiers
      : DEFAULT_FLOW_CONFIG.categories!.jewelry!.budget_tiers!;

    const matched = matchBudgetTier(lower, jewelryTiers);
    state.budget_tier = matched.label;
    state.budget_min = matched.min;
    state.budget_max = matched.max;

    state.current_step = "JEWELRY_COLOR_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: getStepMessage(flowConfig, "jewelry_color"),
    };
  }

  if (state.current_step === "JEWELRY_COLOR_SELECT") {
    if (!isGenericFiller(cleanText)) {
      state.color = cleanText;
      state.gemstone_type = cleanText;
    }
    state.current_step = "JEWELRY_RECIPIENT_AND_DATE";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: getStepMessage(flowConfig, "jewelry_recipient_date"),
    };
  }

  if (state.current_step === "JEWELRY_RECIPIENT_AND_DATE") {
    const foundDate = extractDate(cleanText);
    const foundRecipient = extractRecipient(cleanText);

    if (foundDate && !state.required_date) state.required_date = foundDate;
    if (foundRecipient && !state.gift_recipient) state.gift_recipient = foundRecipient;

    // Only assign raw cleanText if NEITHER date nor recipient regex matched anything and not a generic filler
    if (!foundDate && !foundRecipient) {
      if (!isGenericFiller(cleanText)) {
        if (!state.gift_recipient) {
          state.gift_recipient = cleanText;
        } else if (!state.required_date) {
          state.required_date = cleanText;
        }
      }
    }

    // Still missing delivery date? Ask for it specifically!
    if (state.gift_recipient && !state.required_date) {
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 🎁 මේ jewelry gift එක කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ කියලා target date එකක් කියන්න පුළුවන්ද? 📅",
      };
    }

    // Still missing recipient? Ask for it specifically!
    if (!state.gift_recipient && state.required_date) {
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 📅 මේ jewelry gift එක කාටද දෙන්න හිතන් ඉන්නේ කියලා කියන්න පුළුවන්ද? 🎁",
      };
    }

    // Fallback if neither was set
    if (!state.gift_recipient && !state.required_date) {
      state.gift_recipient = cleanText;
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 🎁 මේ jewelry gift එක කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ කියලා target date එකක් කියන්න පුළුවන්ද? 📅",
      };
    }

    // Both recipient and date collected! Save state immediately so we never loop.
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    // Both recipient and date are collected! Recommend products from the 20 configured products.
    const recommendations = await fetchConfiguredRecommendations(
      supabase,
      userId,
      state.jewelry_type || "Silver Jewelry",
      state.budget_min || 10000,
      state.budget_max || 35000,
      state.color || ""
    );

    state.recommended_products = recommendations;
    state.current_step = "PRODUCT_SELECTION";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const isRing = (state.jewelry_type || "").includes("Ring");
    const settingLabel = isRing ? "Solid 925 Silver Ring Setting" : "Solid 925 Silver Setting";
    const silverSettingCost = flowConfig.categories?.jewelry?.silver_setting_cost || 5000;

    const recLines = recommendations.map((p, idx) => {
      const gemPrice = p.price || 10000;
      return `${idx + 1}️⃣ *${p.name}*\n💎 Gemstone Price: LKR ${gemPrice.toLocaleString()}\n💍 ${settingLabel}: ~LKR ${silverSettingCost.toLocaleString()} ක පමණ (Design එක අනුව vary වේ)\n📜 Government-Registered Gem Lab Certificate Included\n`;
    }).join("\n");

    const disclaimNote = `${getStepMessage(flowConfig, "silver_disclaimer", { cost: silverSettingCost.toLocaleString() })}\n\n`;

    const imageUrls = recommendations.flatMap((p) => p.images || []).slice(0, 2);

    const baseReply = `✨ ඔයාගෙ requirements වලට ගැළපෙන අපේ Silver Jewelry pieces මෙන්න:\n\n${recLines}\n${disclaimNote}මේ options වලින් ඔබ වඩාත්ම කැමති piece එක පහළින් තෝරන්නකෝ 👇`;
    const replyText = withTopBottom(baseReply, flowConfig.categories?.jewelry?.top_message, flowConfig.categories?.jewelry?.bottom_message);

    return {
      handled: true,
      replyText,
      poll: {
        name: "💍 වඩාත්ම කැමති Jewelry Piece එක තෝරන්න:",
        options: recommendations.map((p, idx) => `${idx + 1}️⃣ ${p.name.substring(0, 25)}`),
        multipleAnswers: false,
      },
      imageUrls,
    };
  }

  // --------------------------------------------------------------------------
  // CATEGORY 3: GIFT PACKAGING FLOW
  // --------------------------------------------------------------------------
  if (state.current_step === "PACKAGING_SELECT") {
    state.packaging_requested = cleanText;
    state.current_step = "PACKAGING_RECIPIENT_AND_DATE";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: `Packaging selection: ${cleanText}! 📦✨\n\n${getStepMessage(flowConfig, "gem_recipient_date")}`,
    };
  }

  if (state.current_step === "PACKAGING_RECIPIENT_AND_DATE") {
    const foundDate = extractDate(cleanText);
    const foundRecipient = extractRecipient(cleanText);

    if (foundDate && !state.required_date) state.required_date = foundDate;
    if (foundRecipient && !state.gift_recipient) state.gift_recipient = foundRecipient;

    if (!foundDate && !foundRecipient) {
      if (!state.gift_recipient) {
        state.gift_recipient = cleanText;
      } else if (!state.required_date) {
        state.required_date = cleanText;
      }
    }

    if (state.gift_recipient && !state.required_date) {
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 🎁 මේ packaging එක කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ කියලා target date එකක් කියන්න පුළුවන්ද? 📅",
      };
    }

    if (!state.gift_recipient && state.required_date) {
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 📅 මේ packaging එක කාටද දෙන්න හිතන් ඉන්නේ කියලා කියන්න පුළුවන්ද? 🎁",
      };
    }

    if (!state.gift_recipient && !state.required_date) {
      state.gift_recipient = cleanText;
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);
      return {
        handled: true,
        replyText: "ස්තූතියි! 🎁 මේ packaging එක කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ කියලා target date එකක් කියන්න පුළුවන්ද? 📅",
      };
    }

    state.current_step = "CONFIRMATION";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: `✨ ඔබ තෝරාගත් Gift Packaging විස්තර:\n📦 Option: ${state.packaging_requested}\n🎁 Recipient: ${state.gift_recipient}\n📅 Needed By: ${state.required_date}\n\nමේ විස්තර confirm කරලා sales agent කෙනෙක් සමඟ proceed කරන්නද? 👇`,
      poll: {
        name: "✨ Confirm කරලා proceed කරන්නද?",
        options: [
          "✅ ඔව්, Confirm කරන්න! (Proceed)",
          "🔄 වෙනස් කරන්න (Change)",
        ],
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // PRODUCT SELECTION (Applicable to Gemstone & Jewelry)
  // --------------------------------------------------------------------------
  if (state.current_step === "PRODUCT_SELECTION") {
    let selectedIdx = 0;
    if (lower.includes("1") || lower.includes("first")) selectedIdx = 0;
    else if (lower.includes("2") || lower.includes("second")) selectedIdx = 1;
    else if (lower.includes("3") || lower.includes("third")) selectedIdx = 2;
    else if (state.recommended_products && state.recommended_products.length > 0) {
      const matchP = state.recommended_products.findIndex(p => lower.includes(p.name.toLowerCase()));
      if (matchP >= 0) selectedIdx = matchP;
    }

    const selectedProduct = (state.recommended_products && state.recommended_products[selectedIdx])
      || (state.recommended_products && state.recommended_products[0])
      || { name: "Ceylon Gem", price: state.budget_min || 10000 };

    state.selected_product = selectedProduct;
    state.current_step = "CONFIRMATION";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    const isJewelry = state.category === "Silver Jewelry" || !!state.jewelry_type;
    const gemPrice = selectedProduct.price || 10000;
    const silverSettingCost = flowConfig.categories?.jewelry?.silver_setting_cost || 5000;

    let priceSection = "";
    let noteSection = "";
    if (isJewelry) {
      const isRing = (state.jewelry_type || "").includes("Ring");
      const settingLabel = isRing ? "Solid 925 Silver Ring Setting" : "Solid 925 Silver Setting";
      priceSection = `💎 *Gemstone Price:* LKR ${gemPrice.toLocaleString()}\n💍 *${settingLabel}:* ~LKR ${silverSettingCost.toLocaleString()} ක පමණ (Design එක අනුව vary වේ)\n`;
      noteSection = `\nℹ️ *සැලකිය යුතුයි:* ඔබ තෝරාගන්නා design එක අනුව සම්පූර්ණ අවසන් මිල අපේ sales agent confirm කරනු ඇත.\n`;
    } else {
      priceSection = `💰 *Price:* LKR ${gemPrice.toLocaleString()}\n`;
    }

    const confirmPrompt = getStepMessage(flowConfig, "confirmation");
    const baseConfirmReply = `✨ *ඔබ තෝරාගත් අයිතමය:*\n💎 *${selectedProduct.name}*\n${state.jewelry_type ? `💍 *Jewelry Type:* ${state.jewelry_type}\n` : ""}${state.ring_size ? `💍 *Ring Size:* ${state.ring_size}\n` : ""}${state.size ? `📏 *Size:* ${state.size}\n` : ""}${priceSection}📜 *Gem Lab Certificate:* Included (Worth LKR 1,500)\n🎁 *Recipient:* ${state.gift_recipient || "Special Gift"}\n📅 *Needed By:* ${state.required_date || "Confirmed with Agent"}\n${noteSection}\n${confirmPrompt}`;

    const replyText = withTopBottom(
      baseConfirmReply,
      flowConfig.steps?.confirmation?.top_message || flowConfig.general_messages?.confirmation_top_message,
      flowConfig.steps?.confirmation?.bottom_message || flowConfig.general_messages?.confirmation_bottom_message
    );

    return {
      handled: true,
      replyText,
      poll: {
        name: "✨ Confirm කරලා proceed කරන්නද?",
        options: [
          "✅ ඔව්, Confirm කරන්න! (Proceed)",
          "🔄 වෙනස් කරන්න (Change)",
        ],
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP: CONFIRMATION & LEAD HANDOFF
  // --------------------------------------------------------------------------
  if (state.current_step === "CONFIRMATION") {
    if (lower.includes("confirm") || lower.includes("yes") || lower.includes("ඔව්") || lower.includes("ow") || lower.includes("proceed") || lower.includes("hari") || lower.includes("1")) {
      // QUALIFIED LEAD RECORD CREATION
      const prod = state.selected_product || { name: state.gemstone_type || "Ceylon Gem", price: state.budget_min || 10000 };
      const actualPrice = prod.price || state.budget_min || 10000;
      const isJewelry = state.category === "Silver Jewelry" || !!state.jewelry_type;
      const silverSettingCost = flowConfig.categories?.jewelry?.silver_setting_cost || 5000;
      const priceDescription = isJewelry
        ? `LKR ${actualPrice.toLocaleString()} (Gemstone) + ~LKR ${silverSettingCost.toLocaleString()} (Silver Setting - to be confirmed by agent)`
        : `LKR ${actualPrice.toLocaleString()}`;

      const instructions = [
        `🌟 QUALIFIED LEAD — CEYLONA GEMS`,
        `💎 Category: ${state.category || "Gifting Gemstones"}`,
        state.jewelry_type ? `💍 Jewelry Type: ${state.jewelry_type}` : null,
        state.ring_size ? `💍 Ring Size: ${state.ring_size}` : null,
        state.size ? `📏 Gem Size: ${state.size}` : null,
        `🎨 Gemstone / Color: ${state.gemstone_type || state.color || prod.name}`,
        `💰 Budget Bracket: ${state.budget_tier || "Standard"}`,
        `🎁 Recipient: ${state.gift_recipient || "Special Someone"}`,
        `📅 Needed By: ${state.required_date || "Not Specified"}`,
        `🛍️ Selected Item: ${prod.name}`,
        `💵 Price Details: ${priceDescription}`,
        state.packaging_requested ? `📦 Packaging: ${state.packaging_requested}` : null,
      ].filter(Boolean).join("\n");

      // Insert qualified lead order into Ceylon_gems.orders
      await supabase.from("orders").insert({
        user_id: userId,
        customer_name: senderName || "Interested Customer",
        customer_phone: phoneNumber,
        whatsapp_phone: phoneNumber,
        status: "qualified_lead",
        payment_method: "bank_transfer",
        total_amount: actualPrice,
        special_instructions: instructions,
        order_items: [
          {
            name: prod.name,
            price: actualPrice,
            quantity: 1,
            product_type: "physical",
            details: state,
          },
        ],
      });

      // Update lead status to qualified
      state.current_step = "HANDED_OFF";
      state.handed_off_at = new Date().toISOString();
      await supabase.from("leads").upsert({
        user_id: userId,
        phone_number: phoneNumber,
        customer_name: senderName,
        status: "qualified",
        custom_fields: { flow_state: state, is_qualified: true, handed_off_at: state.handed_off_at },
      }, { onConflict: "user_id,phone_number" });

      // Send owner & team notification alerts (multi-phone support)
      const notifMessage = `🌟 *NEW QUALIFIED LEAD — Ceylona Gems!*\n\n👤 *Customer:* ${senderName || "Customer"}\n📱 *Phone:* ${phoneNumber}\n💎 *Category:* ${state.category}\n🛍️ *Item:* ${prod.name}\n${state.jewelry_type ? `💍 *Jewelry:* ${state.jewelry_type}\n` : ""}${state.ring_size ? `💍 *Size:* ${state.ring_size}\n` : ""}💰 *Budget:* ${state.budget_tier || "N/A"}\n🎁 *Recipient:* ${state.gift_recipient}\n📅 *Needed By:* ${state.required_date}\n💵 *Price Details:* ${priceDescription}\n\n👉 *Reply on WhatsApp to finalize!*`;

      await sendLeadNotifications(supabase, supabaseUrl, supabaseServiceKey, userId, notifMessage, sessionApiKey);

      const defaultReply = isJewelry
        ? "බොහොම ස්තූතියි! 💎 ඔයාගෙ requirements ඔක්කොම මම සටහන් කරගත්තා. ඔබ තෝරාගන්නා design එකට අදාළ silver setting සහ සම්පූර්ණ අවසන් මිල confirm කරගන්න අපේ sales specialist කෙනෙක් ඉක්මනින්ම මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨"
        : "බොහොම ස්තූතියි! 💎 ඔයාගෙ requirements ඔක්කොම මම සටහන් කරගත්තා. අපේ sales specialist කෙනෙක් details confirm කරගන්න ඉක්මනින්ම මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨";

      const configuredHandoff = getStepMessage(flowConfig, "agent_handoff");
      const replyConfirm = configuredHandoff || flowConfig.general_messages?.handoff_message?.trim() || defaultReply;

      return {
        handled: true,
        replyText: replyConfirm,
        isQualified: true,
      };
    } else {
      // User tapped "Change"
      state.current_step = "CATEGORY_SELECT";
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      return {
        handled: true,
        replyText: getStepMessage(flowConfig, "restart_flow"),
        poll: {
          name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
          options: getCategoryPollOptions(flowConfig),
          multipleAnswers: false,
        },
      };
    }
  }

  if (state.current_step === "QUALIFIED_COMPLETE") {
    return {
      handled: true,
      replyText: "අපේ sales team එකෙන් ඔයාව ඉක්මනින්ම සම්බන්ධ කරගනීවි! 💎 වෙනත් gift එකක් තෝරාගැනීමට අවශ්‍ය නම් 'Start' හෝ 'Reset' කියලා එවන්න. ✨",
    };
  }

  // If already handed off, let normal chat / human agent or micro-AI handle
  return { handled: false };
}

// ----------------------------------------------------------------------------
// Helper: Check if user input matches the current step directly
// ----------------------------------------------------------------------------
function isStepMatchingInput(step: string, text: string): boolean {
  const lower = text.toLowerCase().trim();
  switch (step) {
    case "CATEGORY_SELECT":
      return lower.includes("gemstone") || lower.includes("jewelry") || lower.includes("pack") || lower.includes("1") || lower.includes("2") || lower.includes("3") || lower.includes("gifting") || lower.includes("silver");
    case "GEM_BUDGET_SELECT":
    case "JEWELRY_BUDGET_SELECT":
      return lower.includes("4,000") || lower.includes("4000") || lower.includes("10,000") || lower.includes("10000") || lower.includes("20,000") || lower.includes("20000") || lower.includes("35,000") || lower.includes("above") || lower.includes("වැඩි") || lower.includes("1") || lower.includes("2") || lower.includes("3");
    case "GEM_COLOR_SELECT":
    case "JEWELRY_COLOR_SELECT":
      return !text.includes("?") && !lower.includes("delivery") && !lower.includes("cod") && !lower.includes("location");
    case "GEM_SIZE_SELECT":
      return lower.includes("small") || lower.includes("medium") || lower.includes("large") || lower.includes("luxury") || lower.includes("custom") || lower.includes("1") || lower.includes("2") || lower.includes("3") || lower.includes("4");
    case "JEWELRY_TYPE_SELECT":
      return lower.includes("ring") || lower.includes("pendant") || lower.includes("custom") || lower.includes("1") || lower.includes("2") || lower.includes("3") || lower.includes("solid");
    case "RING_SIZE_SELECT":
      return !text.includes("?") && !lower.includes("delivery") && !lower.includes("cod") && !lower.includes("location");
    case "GEM_RECIPIENT_AND_DATE":
    case "JEWELRY_RECIPIENT_AND_DATE":
    case "PACKAGING_RECIPIENT_AND_DATE":
      if (Boolean(extractDate(text) || extractRecipient(text))) return true;
      return !text.includes("?") && !lower.includes("delivery fee") && !lower.includes("cod") && !lower.includes("location") && !lower.includes("koheda");
    case "PRODUCT_SELECTION":
      return lower.includes("1") || lower.includes("2") || lower.includes("3") || lower.includes("first") || lower.includes("second") || lower.includes("third") || lower.includes("gemstone") || lower.includes("sapphire") || lower.includes("ring") || lower.includes("pendant") || lower.includes("silver") || lower.includes("solid") || lower.includes("ruby") || lower.includes("amethyst") || lower.includes("halo") || lower.includes("solitaire");
    case "CONFIRMATION":
      return lower.includes("confirm") || lower.includes("yes") || lower.includes("ඔව්") || lower.includes("ow") || lower.includes("change") || lower.includes("1") || lower.includes("2");
    default:
      return false;
  }
}

// ----------------------------------------------------------------------------
// Helper: Generate Return-to-Flow transition text and poll
// ----------------------------------------------------------------------------
export function getResumePromptForStep(state: LeadFlowState, flowConfig?: ChatFlowConfig): { text: string; poll?: FlowPoll } {
  const cfg = flowConfig || DEFAULT_FLOW_CONFIG;
  switch (state.current_step) {
    case "CATEGORY_SELECT":
      return {
        text: getStepMessage(cfg, "greeting"),
        poll: {
          name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
          options: getCategoryPollOptions(cfg),
          multipleAnswers: false,
        },
      };
    case "GEM_BUDGET_SELECT": {
      const gemTiers = cfg.categories?.gemstones?.budget_tiers || DEFAULT_FLOW_CONFIG.categories!.gemstones!.budget_tiers!;
      return {
        text: getStepMessage(cfg, "gem_budget"),
        poll: {
          name: "💰 Gemstone සඳහා Budget Range එක තෝරන්න:",
          options: gemTiers.map((t) => t.label),
          multipleAnswers: false,
        },
      };
    }
    case "JEWELRY_BUDGET_SELECT": {
      const jewelryTiers = cfg.categories?.jewelry?.budget_tiers || DEFAULT_FLOW_CONFIG.categories!.jewelry!.budget_tiers!;
      return {
        text: getStepMessage(cfg, "jewelry_budget"),
        poll: {
          name: "💰 Silver Jewelry Budget Range:",
          options: jewelryTiers.map((t) => t.label),
          multipleAnswers: false,
        },
      };
    }
    case "RING_SIZE_SELECT":
      return {
        text: getStepMessage(cfg, "ring_size"),
      };
    case "GEM_COLOR_SELECT":
      return {
        text: getStepMessage(cfg, "gem_color"),
      };
    case "JEWELRY_COLOR_SELECT":
      return {
        text: getStepMessage(cfg, "jewelry_color"),
      };
    case "GEM_SIZE_SELECT":
      return {
        text: getStepMessage(cfg, "gem_size"),
        poll: {
          name: "📏 Gemstone එකේ Size එක තෝරන්න:",
          options: [
            "🔹 Small Size (Delicate)",
            "🔹 Medium Size (Classic)",
            "🔹 Large Size (Statement)",
            "🔹 Custom Luxury Size",
          ],
          multipleAnswers: false,
        },
      };
    case "JEWELRY_TYPE_SELECT":
      return {
        text: getStepMessage(cfg, "jewelry_type"),
        poll: {
          name: "💍 Silver Jewelry වර්ගය තෝරන්න:",
          options: [
            "1️⃣ Solid 925 Silver Ring",
            "2️⃣ Solid 925 Silver Pendant",
            "3️⃣ Custom Design Piece",
          ],
          multipleAnswers: false,
        },
      };
    case "GEM_RECIPIENT_AND_DATE":
      return {
        text: getStepMessage(cfg, "gem_recipient_date"),
      };
    case "JEWELRY_RECIPIENT_AND_DATE":
      return {
        text: getStepMessage(cfg, "jewelry_recipient_date"),
      };
    case "PACKAGING_SELECT":
      return {
        text: getStepMessage(cfg, "packaging_select"),
      };
    case "PRODUCT_SELECTION":
      return {
        text: "ඉහත recommendations වලින් ඔබ කැමති piece එක තෝරන්නකෝ 👇",
      };
    case "CONFIRMATION":
      return {
        text: getStepMessage(cfg, "confirmation"),
        poll: {
          name: "✨ Confirm කරලා proceed කරන්නද?",
          options: [
            "✅ ඔව්, Confirm කරන්න! (Proceed)",
            "🔄 වෙනස් කරන්න (Change)",
          ],
          multipleAnswers: false,
        },
      };
    default:
      return {
        text: "ඔබට අවශ්‍ය තවත් විස්තර තියෙනවද? ✨",
      };
  }
}

// ----------------------------------------------------------------------------
// Helper: Save flow state to leads table
// ----------------------------------------------------------------------------
async function saveFlowState(
  supabase: SupabaseClient,
  userId: string,
  phoneNumber: string,
  customerName: string,
  flowState: LeadFlowState
) {
  try {
    const isQualified =
      flowState.current_step === "HANDED_OFF" ||
      flowState.current_step === "QUALIFIED_COMPLETE";

    await supabase.from("leads").upsert(
      {
        user_id: userId,
        phone_number: phoneNumber,
        customer_name: customerName || "Customer",
        status: isQualified ? "qualified" : "in_progress",
        custom_fields: {
          flow_state: flowState,
          is_qualified: isQualified,
          ...(flowState.handed_off_at ? { handed_off_at: flowState.handed_off_at } : {}),
        },
      },
      { onConflict: "user_id,phone_number" }
    );
  } catch (err) {
    console.error("[FlowController] Error saving flow state:", err);
  }
}

// ----------------------------------------------------------------------------
// Helper: Fetch Configured Recommendations from Ceylon_gems.products (ZERO HALLUCINATION)
// ----------------------------------------------------------------------------
async function fetchConfiguredRecommendations(
  supabase: SupabaseClient,
  userId: string,
  categoryKeyword: string,
  budgetMin: number,
  budgetMax: number,
  colorKeyword: string
): Promise<any[]> {
  try {
    const { data: allProducts } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!allProducts || allProducts.length === 0) return [];

    // Filter by category: Ceylon_gems catalog contains gemstones which are used both for loose gifts and silver jewelry
    let pool = allProducts.filter((p: any) => {
      const pName = (p.name || "").toLowerCase();
      return !pName.includes("box") && !pName.includes("card") && !pName.includes("hamper") && !pName.includes("packaging");
    });

    if (pool.length === 0) pool = allProducts;

    // Check if budget is in the expensive range (LKR 20,000 - 25,000+ or budgetMin >= 20000)
    const isExpensiveBudget = budgetMin >= 20000 || (budgetMin + budgetMax) / 2 >= 20000;

    // Score by tier priority, color/gemstone match, and budget
    const cleanColor = (colorKeyword || "").toLowerCase().trim();
    const scored = pool.map((p: any) => {
      let score = 0;
      const pName = (p.name || "").toLowerCase();
      const pDesc = (p.description || "").toLowerCase();
      const pPrice = Number(p.price) || 0;
      const pTier = p.tier || (pPrice >= 20000 ? "expensive" : "most_sellers");

      // Tier Priority:
      // When customer chooses an expensive budget (20,000 - 25,000+), suggest 'expensive' products FIRST.
      // For standard budget, suggest 'most_sellers' products.
      if (isExpensiveBudget) {
        if (pTier === "expensive") {
          score += 50;
        } else {
          score += 5; // fallback
        }
      } else {
        if (pTier === "most_sellers") {
          score += 40;
        } else {
          score -= 20; // deprioritize expensive products for standard budgets
        }
      }

      // High priority for color/gemstone match
      if (cleanColor && cleanColor.length >= 3 && (pName.includes(cleanColor) || pDesc.includes(cleanColor))) {
        score += 30;
      }

      // Proximity to budget
      if (pPrice >= budgetMin && pPrice <= budgetMax) {
        score += 20;
      } else {
        // Penalty for being outside target budget bracket
        const midpoint = (budgetMin + budgetMax) / 2;
        const diff = Math.abs(pPrice - midpoint);
        score -= Math.min(15, Math.floor(diff / 2000));
      }
      return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 2).map((s) => s.product);
  } catch (err) {
    console.error("[FlowController] Catalog query error:", err);
    return [];
  }
}

