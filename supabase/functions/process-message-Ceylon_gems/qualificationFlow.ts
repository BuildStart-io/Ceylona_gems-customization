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

  // Check if explicit reset/restart is requested (e.g. "start", "reset", "begin", "මුල සිට")
  const isExplicitReset = /^(start|begin|restart|reset|මුල සිට|අලුත්|new order|new gift)$/i.test(lower);
  // General greetings only reset to START if lead is NOT already qualified or in an active flow
  const isGreeting = /^(hi|hello|hey|hlw|hlo|halo|ආයුබෝවන්|සාදරයෙන්|வணக்கம்|ஹலோ)$/i.test(lower);

  if (isExplicitReset || (isGreeting && !isAlreadyQualified && state.current_step === "START")) {
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
          options: [
            "💎 Gifting Gemstones",
            "💍 Silver Jewelry (Rings & Pendants)",
            "🎁 Gift Packaging & Cards",
          ],
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
            options: [
              "💎 Gifting Gemstones",
              "💍 Silver Jewelry (Rings & Pendants)",
              "🎁 Gift Packaging & Cards",
            ],
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
    const greetingText = initialFaq
      ? `${initialFaq}\n\nඅපි ඔයාට ලස්සනම gift එකක් තෝරගන්නත් උදව් කරන්නම්. ✨\nඔයා බලන්න කැමති මොන gift option එකද? පහළින් තෝරන්නකෝ 👇`
      : "ආයුබෝවන්! 💎 Ceylona Gems & Jewelry වෙත සාදරයෙන් පිළිගන්නවා. අපි ඔයාට ලස්සනම gift එකක් තෝරගන්න උදව් කරන්නම්. ✨\n\nඔයා බලන්න කැමති මොන gift option එකද? පහළින් තෝරන්නකෝ 👇";

    return {
      handled: true,
      replyText: greetingText,
      poll: {
        name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
        options: [
          "💎 Gifting Gemstones",
          "💍 Silver Jewelry (Rings & Pendants)",
          "🎁 Gift Packaging & Cards",
        ],
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // GLOBAL CATEGORY SWITCH GUARD (WhatsApp Poll One-Touch & Category Change)
  // --------------------------------------------------------------------------
  // If the user taps a Category poll option or requests a Category at ANY time,
  // immediately transition cleanly to that Category flow, wiping any stale cross-category fields.
  const isGiftingGemstonesVote =
    lower.includes("gifting gemstone") ||
    lower === "💎 gifting gemstones" ||
    (state.current_step === "CATEGORY_SELECT" && (lower.includes("gemstone") || lower.includes("මැණික්") || lower === "1"));

  const isSilverJewelryVote =
    lower.includes("silver jewelry") ||
    lower.includes("rings & pendants") ||
    lower === "💍 silver jewelry (rings & pendants)" ||
    (state.category === "Gifting Gemstone" && (lower.includes("silver") || lower.includes("ring") || lower.includes("pendant") || lower.includes("රිදී"))) ||
    (state.current_step === "CATEGORY_SELECT" && (lower.includes("jewelry") || lower.includes("silver") || lower.includes("රිදී") || lower.includes("ring") || lower.includes("pendant") || lower === "2"));

  const isGiftPackagingVote =
    lower.includes("gift packaging") ||
    lower.includes("packaging & cards") ||
    lower === "🎁 gift packaging & cards" ||
    (state.current_step === "CATEGORY_SELECT" && (lower.includes("packaging") || lower.includes("box") || lower.includes("card") || lower === "3"));

  if (isGiftingGemstonesVote) {
    state = {
      category: "Gifting Gemstone",
      current_step: "GEM_BUDGET_SELECT",
    };
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "නියමයි! 💎 අපේ හැම gemstone එකකටම රජයේ ලියාපදිංචි Gem Lab Certificate එකක් ඇතුළත් කරලා තියෙන්නේ (LKR 1,500ක සහතිකයක් මිලටම ඇතුළත්). ✨\n\nඔයා බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇",
      poll: {
        name: "💰 Gemstone සඳහා Budget Range එක තෝරන්න:",
        options: [
          "🔹 LKR 4,000 – 10,000",
          "🔹 LKR 10,000 – 20,000",
          "🔹 Above LKR 20,000",
        ],
        multipleAnswers: false,
      },
    };
  }

  if (isSilverJewelryVote) {
    state = {
      category: "Silver Jewelry",
      current_step: "JEWELRY_TYPE_SELECT",
    };
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "හරිම ලස්සන තේරීමක්! 💍✨ අපේ Silver Jewelry collection එක Solid 925 Silver වලින් master craftsmanship එකෙන් නිර්මාණය කරන්නේ (Handcrafted Silver pieces start from LKR 10,000+).\n\nඔයා කැමති jewelry වර්ගය පහළින් තෝරන්නකෝ 👇",
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

  if (isGiftPackagingVote) {
    state = {
      category: "Gift Packaging",
      current_step: "PACKAGING_SELECT",
    };
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "අපි ළඟ තෑගි සඳහා විශේෂ Gift Packaging සහ Presentation options තියෙනවා: 🎁✨\n\nඔයා කැමති option එක පහළින් තෝරන්නකෝ 👇",
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
    const resumePrompt = getResumePromptForStep(state);
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
    return {
      handled: true,
      replyText: "ඔයාට gift එකක් විදිහට තෝරාගන්න කැමති category එක පහළින් තෝරන්නකෝ 👇",
      poll: {
        name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
        options: [
          "💎 Gifting Gemstones",
          "💍 Silver Jewelry (Rings & Pendants)",
          "🎁 Gift Packaging & Cards",
        ],
        multipleAnswers: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // CATEGORY 1: GIFTING GEMSTONE FLOW
  // --------------------------------------------------------------------------
  if (state.current_step === "GEM_BUDGET_SELECT") {
    if (lower.includes("above") || lower.includes("වැඩි") || lower.startsWith("3")) {
      state.budget_tier = "Above LKR 20,000";
      state.budget_min = 20000;
      state.budget_max = 150000;
    } else if (lower.includes("4,000") || lower.includes("4000") || lower.startsWith("1") || (lower.includes("10,000") && !lower.includes("20,000"))) {
      state.budget_tier = "LKR 4,000 – 10,000";
      state.budget_min = 4000;
      state.budget_max = 10000;
    } else {
      state.budget_tier = "LKR 10,000 – 20,000";
      state.budget_min = 10000;
      state.budget_max = 20000;
    }

    state.current_step = "GEM_COLOR_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "Great! 💎 ඔයා කැමති Gemstone එකක් හෝ කැමති Color එකක් තියෙනවද? ✨",
    };
  }

  if (state.current_step === "GEM_COLOR_SELECT") {
    state.color = cleanText;
    state.gemstone_type = cleanText;
    state.current_step = "GEM_SIZE_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    // Check if the requested color/stone matches catalog
    const colorLower = cleanText.toLowerCase();
    const availableColors = ["blue", "pink", "yellow", "red", "green", "purple", "pushparaga", "ruby", "sapphire", "amethyst", "garnet", "tsavorite", "නිල්", "රතු", "කහ", "රෝස", "දම්", "පච්ච"];
    const isColorAvailable = availableColors.some(c => colorLower.includes(c));

    const colorNote = (!isColorAvailable && colorLower !== "any" && colorLower !== "kisi" && colorLower !== "ona ekak" && colorLower !== "all")
      ? `(${cleanText} natural gems stock එකේ නැති වුණත්, අපේ popular Royal Blue, Baby Pink, Ruby Red, Golden Yellow sapphire සහ Purple Amethyst වලින් හොඳම gemstone එකක් තෝරගන්න පුළුවන් ✨)\n\n`
      : "";

    return {
      handled: true,
      replyText: `Super choice! 💎 ${colorNote}ඔයා බලාපොරොත්තු වෙන Gemstone Size එක පහළින් තෝරන්නකෝ 👇`,
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
      replyText: "Perfect! 🎁 මේ special gift එක කාටද දෙන්න හිතන් ඉන්නේ? ඒ වගේම කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ? 📅✨",
    };
  }

  if (state.current_step === "GEM_RECIPIENT_AND_DATE") {
    const foundDate = extractDate(cleanText);
    const foundRecipient = extractRecipient(cleanText);

    if (foundDate && !state.required_date) state.required_date = foundDate;
    if (foundRecipient && !state.gift_recipient) state.gift_recipient = foundRecipient;

    // Only assign raw cleanText if NEITHER date nor recipient regex matched anything
    if (!foundDate && !foundRecipient) {
      if (!state.gift_recipient) {
        state.gift_recipient = cleanText;
      } else if (!state.required_date) {
        state.required_date = cleanText;
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

    return {
      handled: true,
      replyText: `✨ ඔයාගෙ requirements වලට ගැළපෙන අපේ හොඳම Gemstones මෙන්න:\n\n${recLines}\nමේ options වලින් ඔයා වඩාත්ම කැමති piece එක පහළින් තෝරන්නකෝ 👇`,
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
        replyText: "Solid 925 Silver Rings! 💍 ඔයාගෙ Ring Size එක දන්නවද? ✨",
      };
    } else if (lower.includes("pendant") || lower.includes("පෙන්ඩන්ට්") || lower.includes("2")) {
      state.jewelry_type = "Silver Pendant";
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
    } else if (lower.includes("custom") || lower.includes("bespoke") || lower.includes("3") || lower.includes("design") || lower.includes("විශේෂ")) {
      // Custom Goldsmithing Hand-off
      state.jewelry_type = "Custom Design";
      state.current_step = "CUSTOM_HANDOFF";
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      return {
        handled: true,
        replyText: "Custom Goldsmithing & Bespoke Design! 💎 අපේ master jeweler කෙනෙක් ඔයාගෙ design එක සහ gemstone mounting ගැන කතා කරන්න සූදානම්. ඔයා බලාපොරොත්තු වෙන design එක සහ budget එක කෙටියෙන් සඳහන් කරන්නකෝ. ✨",
      };
    } else {
      return {
        handled: true,
        replyText: "ඔයා කැමති jewelry වර්ගය පහළින් තෝරන්නකෝ 👇",
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

    try {
      const { data: notifSettings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "order_notifications")
        .eq("user_id", userId)
        .single();

      const ownerPhone = notifSettings?.value?.phone;
      if (ownerPhone) {
        const notifMessage = `🌟 *NEW CUSTOM DESIGN LEAD — Ceylona Gems!*\n\n👤 *Customer:* ${senderName || "Customer"}\n📱 *Phone:* ${phoneNumber}\n💎 *Category:* Custom Goldsmithing / Bespoke\n📝 *Details:* ${cleanText}\n\n👉 *Reply on WhatsApp to assist with custom design!*`;
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-Ceylon_gems`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: ownerPhone,
            message: notifMessage,
            sessionApiKey,
          }),
        });
      }
    } catch (err) {
      console.warn("[FlowController] Owner alert error for custom design:", err);
    }

    return {
      handled: true,
      replyText: "බොහොම ස්තූතියි! 💎 ඔයාගෙ custom design request එක අපේ master jeweler ට යොමු කළා. විස්තර confirm කරගන්න අපේ specialist කෙනෙක් ඉක්මනින්ම මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨",
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

    const sizeNote = isUnknownSize
      ? "කිසිම ප්‍රශ්නයක් නෑ! 💍 අපේ silver rings standard adjustable sizes වලිනුත් ලබාගන්න පුළුවන්, ඒ වගේම අපේ specialist ඔයාට ring size එක මැනගන්න guide එකක් ලබාදෙයි. ✨"
      : `Ring Size: ${cleanText} සටහන් කරගත්තා! 💍`;

    return {
      handled: true,
      replyText: `${sizeNote}\n\nSilver Jewelry සඳහා ඔබ බලාපොරොත්තු වෙන Budget Range එක පහළින් තෝරන්නකෝ 👇`,
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

  if (state.current_step === "JEWELRY_BUDGET_SELECT") {
    if (lower.includes("above") || lower.includes("වැඩි") || lower.startsWith("3")) {
      state.budget_tier = "Above LKR 35,000";
      state.budget_min = 35000;
      state.budget_max = 150000;
    } else if (lower.includes("10,000") || lower.includes("10000") || lower.startsWith("1")) {
      state.budget_tier = "LKR 10,000 – 20,000";
      state.budget_min = 10000;
      state.budget_max = 20000;
    } else {
      state.budget_tier = "LKR 20,000 – 35,000";
      state.budget_min = 20000;
      state.budget_max = 35000;
    }

    state.current_step = "JEWELRY_COLOR_SELECT";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "හරිම හොඳයි! ✨ Jewelry එකට ඔබ කැමති Gemstone එකක් හෝ Color එකක් තියෙනවද? 💎 (උදා: Blue Sapphire, Pink Sapphire, Ruby, Amethyst, Green Tsavorite, etc.)",
    };
  }

  if (state.current_step === "JEWELRY_COLOR_SELECT") {
    state.color = cleanText;
    state.gemstone_type = cleanText;
    state.current_step = "JEWELRY_RECIPIENT_AND_DATE";
    await saveFlowState(supabase, userId, phoneNumber, senderName, state);

    return {
      handled: true,
      replyText: "Super! 🎁 මේ jewelry gift එක කාටද දෙන්න හිතන් ඉන්නේ? ඒ වගේම කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ? 📅✨",
    };
  }

  if (state.current_step === "JEWELRY_RECIPIENT_AND_DATE") {
    const foundDate = extractDate(cleanText);
    const foundRecipient = extractRecipient(cleanText);

    if (foundDate && !state.required_date) state.required_date = foundDate;
    if (foundRecipient && !state.gift_recipient) state.gift_recipient = foundRecipient;

    // Only assign raw cleanText if NEITHER date nor recipient regex matched anything
    if (!foundDate && !foundRecipient) {
      if (!state.gift_recipient) {
        state.gift_recipient = cleanText;
      } else if (!state.required_date) {
        state.required_date = cleanText;
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
    const recLines = recommendations.map((p, idx) => {
      const priceEst = isRing
        ? `LKR ${(p.price || 12500).toLocaleString()} – ${((p.price || 12500) + 7500).toLocaleString()}`
        : `LKR ${p.price?.toLocaleString()}`;
      return `${idx + 1}️⃣ *${p.name}*\n💰 Estimated Price: ${priceEst} (Gemstone + Silver Setting)\n💍 Solid 925 Sterling Silver\n📜 Gem Lab Certificate Included\n`;
    }).join("\n");

    const disclaimNote = isRing
      ? "ℹ️ *සැලකිය යුතුයි:* Design එක අනුව final price එක වෙනස් වෙන්න පුළුවන්. ඔබ තෝරාගන්නා design එකට අදාළ සම්පූර්ණ අවසන් මිල අපේ sales agent confirm කරලා දෙනු ඇත.\n\n"
      : "";

    const imageUrls = recommendations.flatMap((p) => p.images || []).slice(0, 2);

    return {
      handled: true,
      replyText: `✨ ඔයාගෙ requirements වලට ගැළපෙන අපේ Silver Jewelry pieces මෙන්න:\n\n${recLines}\n${disclaimNote}මේ options වලින් ඔබ වඩාත්ම කැමති piece එක පහළින් තෝරන්නකෝ 👇`,
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
      replyText: `Packaging selection: ${cleanText}! 📦✨\n\nමේ gift packaging එක කාටද දෙන්න හිතන් ඉන්නේ? ඒ වගේම කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ? 📅🎁`,
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

    const priceText = state.jewelry_type?.includes("Ring")
      ? `LKR ${(selectedProduct.price || 12500).toLocaleString()} – ${((selectedProduct.price || 12500) + 7500).toLocaleString()} (Gemstone + Silver Setting)`
      : `LKR ${(selectedProduct.price || 10000).toLocaleString()}`;

    return {
      handled: true,
      replyText: `✨ *ඔබ තෝරාගත් අයිතමය:*\n💎 *${selectedProduct.name}*\n${state.ring_size ? `💍 *Ring Size:* ${state.ring_size}\n` : ""}${state.size ? `📏 *Size:* ${state.size}\n` : ""}💰 *Estimated Price:* ${priceText}\n📜 *Gem Lab Certificate:* Included (Worth LKR 1,500)\n🎁 *Recipient:* ${state.gift_recipient || "Special Gift"}\n📅 *Needed By:* ${state.required_date || "Confirmed with Agent"}\n\nමේ විස්තර ඔක්කොම හරිද? Order එක confirm කරලා proceed කරන්නද? ✨`,
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
        `💵 Base / Estimated Price: LKR ${actualPrice.toLocaleString()}`,
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

      // Send owner notification alert
      try {
        const { data: notifSettings } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "order_notifications")
          .eq("user_id", userId)
          .single();

        const ownerPhone = notifSettings?.value?.phone;
        if (ownerPhone) {
          const notifMessage = `🌟 *NEW QUALIFIED LEAD — Ceylona Gems!*\n\n👤 *Customer:* ${senderName || "Customer"}\n📱 *Phone:* ${phoneNumber}\n💎 *Category:* ${state.category}\n🛍️ *Item:* ${prod.name}\n${state.ring_size ? `💍 *Size:* ${state.ring_size}\n` : ""}💰 *Budget:* ${state.budget_tier || "N/A"}\n🎁 *Recipient:* ${state.gift_recipient}\n📅 *Needed By:* ${state.required_date}\n💵 *Price:* LKR ${actualPrice.toLocaleString()}\n\n👉 *Reply on WhatsApp to finalize!*`;

          await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-Ceylon_gems`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: ownerPhone,
              message: notifMessage,
              sessionApiKey,
            }),
          });
        }
      } catch (err) {
        console.warn("[FlowController] Owner alert error:", err);
      }

      return {
        handled: true,
        replyText: "බොහොම ස්තූතියි! 💎 ඔයාගෙ requirements ඔක්කොම මම සටහන් කරගත්තා. අපේ sales specialist කෙනෙක් details confirm කරගන්න ඉක්මනින්ම මේ chat එකෙන්ම ඔයාව සම්බන්ධ කරගනීවි. ✨",
        isQualified: true,
      };
    } else {
      // User tapped "Change"
      state.current_step = "CATEGORY_SELECT";
      await saveFlowState(supabase, userId, phoneNumber, senderName, state);

      return {
        handled: true,
        replyText: "කිසි ප්‍රශ්නයක් නෑ! 🔄 අපි නැවත මුල සිට තෝරාගනිමු. ඔයා කැමති category එක පහළින් තෝරන්නකෝ 👇",
        poll: {
          name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
          options: [
            "💎 Gifting Gemstones",
            "💍 Silver Jewelry (Rings & Pendants)",
            "🎁 Gift Packaging & Cards",
          ],
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
export function getResumePromptForStep(state: LeadFlowState): { text: string; poll?: FlowPoll } {
  switch (state.current_step) {
    case "CATEGORY_SELECT":
      return {
        text: "දැන් අපි ඔයාගෙ gift එක තෝරගමු! ඔයා කැමති category එක පහළින් තෝරන්නකෝ 👇",
        poll: {
          name: "🎁 ඔබ සොයන Gift Option එක තෝරන්න:",
          options: [
            "💎 Gifting Gemstones",
            "💍 Silver Jewelry (Rings & Pendants)",
            "🎁 Gift Packaging & Cards",
          ],
          multipleAnswers: false,
        },
      };
    case "GEM_BUDGET_SELECT":
      return {
        text: "දැන් ඔයාගෙ gemstone එකට budget range එක තෝරන්නකෝ 👇",
        poll: {
          name: "💰 Gemstone සඳහා Budget Range එක තෝරන්න:",
          options: [
            "🔹 LKR 4,000 – 10,000",
            "🔹 LKR 10,000 – 20,000",
            "🔹 Above LKR 20,000",
          ],
          multipleAnswers: false,
        },
      };
    case "JEWELRY_BUDGET_SELECT":
      return {
        text: "දැන් Silver Jewelry සඳහා ඔබ බලාපොරොත්තු වෙන Budget Range එක තෝරන්නකෝ 👇",
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
    case "RING_SIZE_SELECT":
      return {
        text: "Solid 925 Silver Rings සඳහා ඔයාගෙ Ring Size එක කියන්නකෝ (උදා: US 6, 7, 8 හෝ 'දන්නේ නෑ' කියලා කියන්න පුළුවන්) 💍✨",
      };
    case "GEM_COLOR_SELECT":
    case "JEWELRY_COLOR_SELECT":
      return {
        text: "Jewelry එකට ඔබ කැමති Gemstone එකක් හෝ Color එකක් තියෙනවද? 💎 (උදා: Blue Sapphire, Pink Sapphire, Ruby, Amethyst, etc.)",
      };
    case "GEM_SIZE_SELECT":
      return {
        text: "ඔයා බලාපොරොත්තු වෙන Gemstone Size එක පහළින් තෝරන්නකෝ 👇",
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
        text: "ඔබ කැමති Silver Jewelry වර්ගය පහළින් තෝරන්නකෝ 👇",
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
    case "JEWELRY_RECIPIENT_AND_DATE":
      return {
        text: "මේ gift එක කාටද දෙන්න හිතන් ඉන්නේ? ඒ වගේම කවද්ද delivery කරගන්න ඕනෙ වෙන්නේ? 🎁📅",
      };
    case "PRODUCT_SELECTION":
      return {
        text: "ඉහත recommendations වලින් ඔබ කැමති piece එක තෝරන්නකෝ 👇",
      };
    case "CONFIRMATION":
      return {
        text: "ඔබ තෝරාගත් piece එක confirm කරලා proceed කරන්නද? 👇",
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

    const isRing = categoryKeyword.toLowerCase().includes("ring");
    const isPendant = categoryKeyword.toLowerCase().includes("pendant");
    const isJewelry = categoryKeyword.toLowerCase().includes("silver") || isRing || isPendant;

    // Filter by category
    let pool = allProducts.filter((p: any) => {
      const pName = (p.name || "").toLowerCase();
      if (isRing) return pName.includes("ring");
      if (isPendant) return pName.includes("pendant");
      if (isJewelry) return pName.includes("ring") || pName.includes("pendant") || pName.includes("silver");
      // Gemstone
      return !pName.includes("ring") && !pName.includes("pendant") && !pName.includes("box") && !pName.includes("card") && !pName.includes("hamper");
    });

    if (pool.length === 0) pool = allProducts.slice(0, 5);

    // Score by color/gemstone match and budget
    const cleanColor = colorKeyword.toLowerCase();
    const scored = pool.map((p: any) => {
      let score = 0;
      const pName = p.name.toLowerCase();
      const pDesc = (p.description || "").toLowerCase();

      // High priority for color/gemstone match
      if (cleanColor && cleanColor.length >= 3 && (pName.includes(cleanColor) || pDesc.includes(cleanColor))) {
        score += 25;
      }
      // High priority for budget match
      if (p.price >= budgetMin && p.price <= budgetMax) {
        score += 15;
      } else {
        // Penalty for being outside target budget bracket
        const midpoint = (budgetMin + budgetMax) / 2;
        const diff = Math.abs(p.price - midpoint);
        score -= Math.min(10, Math.floor(diff / 2000));
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

