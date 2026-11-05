import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConversationMessage {
  message: string;
  direction: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const delegatesAi = !!(Deno.env.get("AI_GENERATE_URL") && Deno.env.get("BOT_API_KEY"));
    if (!lovableApiKey && !delegatesAi) {
      throw new Error("Neither LOVABLE_API_KEY nor AI_GENERATE_URL/BOT_API_KEY configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "Ceylon_gems" },
    });

    const { message, phoneNumber, conversationHistory, userId, sessionApiKey, senderName } = await req.json();

    console.log(`Processing AI chat for ${phoneNumber} (user: ${userId}): ${message}`);

    // Fetch products, FAQs, settings, profile, and platform limits
    const [productsRes, faqsRes, settingsRes, profileRes, platformLimitsRes] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).eq("user_id", userId),
      supabase.from("faqs").select("*, products(name)").eq("is_active", true).eq("user_id", userId),
      supabase.from("settings").select("key, value").eq("user_id", userId),
      supabase.from("profiles").select("plan_tier, billing_cycle_start, is_paused, addon_contacts, addon_orders").eq("user_id", userId).single(),
      supabase.from("platform_settings").select("value").eq("key", "plan_limits").single(),
    ]);

    // Check if account is paused
    if (profileRes.data?.is_paused) {
      console.log(`Account paused for user ${userId}`);
      return new Response(
        JSON.stringify({ error: "Account paused", response: "Sorry, this business account is currently paused. Please try again later." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planTier = profileRes.data?.plan_tier || "free";
    const allLimits = platformLimitsRes.data?.value || {};
    const tierLimits = allLimits[planTier] || {};
    const contactLimit = (tierLimits.contacts_per_month || 50) + (profileRes.data?.addon_contacts || 0);

    // Use billing cycle start for monthly count
    const billingStart = profileRes.data?.billing_cycle_start;
    let monthStart: string;
    if (billingStart) {
      const start = new Date(billingStart);
      const now = new Date();
      const current = new Date(start);
      while (true) {
        const next = new Date(current);
        next.setMonth(next.getMonth() + 1);
        if (next > now) break;
        current.setMonth(current.getMonth() + 1);
      }
      monthStart = current.toISOString();
    } else {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      monthStart = d.toISOString();
    }

    // Contact-based billing: only NEW contacts are blocked once the allowance is used up.
    const contactKey = String(phoneNumber || "").split("@")[0].replace(/\D/g, "");
    const { data: alreadyCounted } = await supabase
      .from("contact_usage")
      .select("id")
      .eq("user_id", userId)
      .eq("phone_number", contactKey)
      .gte("created_at", monthStart)
      .maybeSingle();

    const { data: contactsUsed } = await supabase.rpc("get_contact_usage", {
      _user_id: userId,
      _since: monthStart,
    });

    // Also check orders limit
    const ordersLimit = (tierLimits.max_orders_per_month || 50) + (profileRes.data?.addon_orders || 0);
    const { count: ordersCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart);

    if (!alreadyCounted && (contactsUsed || 0) >= contactLimit) {
      console.log(`Contact limit reached for user ${userId}: ${contactsUsed}/${contactLimit}`);
      return new Response(
        JSON.stringify({ error: "Monthly contact limit reached. Please upgrade your plan.", response: "Sorry, the monthly contact limit has been reached. Please contact the business owner." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ordersLimitReached = (ordersCount || 0) >= ordersLimit;

    const products = productsRes.data || [];
    const faqs = faqsRes.data || [];
    const settings = settingsRes.data || [];

    const welcomeMessage = settings.find(s => s.key === "welcome_message")?.value?.text || "Welcome! How can I help you?";
    const paymentInfo = settings.find(s => s.key === "payment_info")?.value || {};
    const deliverySettings = settings.find(s => s.key === "delivery_settings")?.value || {};
    const freeDeliveryThreshold = deliverySettings.free_delivery_threshold || 0;

    const productCatalog = products.map(p => {
      let line = `- ${p.name}: Base price LKR ${p.price} (${p.product_type})`;
      if (p.product_type === "physical" && p.delivery_price && p.delivery_price > 0) {
        line += ` | Delivery fee: LKR ${p.delivery_price}`;
      }
      if (p.description) line += ` - ${p.description}`;
      if (p.images && Array.isArray(p.images) && p.images.length > 0) {
        line += ` | Images: ${p.images.join(", ")}`;
      }
      if (p.video_url) {
        line += ` | Video: ${p.video_url}`;
      }
      if (p.variations && Array.isArray(p.variations) && p.variations.length > 0) {
        const varLines = p.variations.map((v: any) => {
          const opts = v.options?.map((o: any) => {
            if (typeof o !== "object") return o;
            let optStr = `${o.label}: LKR ${o.price}`;
            if (o.subVariants && Array.isArray(o.subVariants) && o.subVariants.length > 0) {
              const subLines = o.subVariants.map((sv: any) => {
                const reqTag = sv.required ? " (REQUIRED)" : " (optional)";
                const subOpts = sv.options?.map((so: any) =>
                  typeof so === "object" ? `${so.label}: +LKR ${so.price}` : so
                ).join(", ");
                return `[${sv.name}${reqTag}: ${subOpts}]`;
              }).join(" ");
              optStr += ` ${subLines}`;
            }
            return optStr;
          }).join(", ");
          return `${v.name}: ${opts}`;
        }).join("; ");
        line += ` | Variations: ${varLines}`;
      }
      return line;
    }).join("\n");

    // Build a map of product name → first image URL for sending images
    const productImageMap: Record<string, string> = {};
    const productVideoMap: Record<string, string> = {};
    for (const p of products) {
      if (p.images && Array.isArray(p.images) && p.images.length > 0) {
        productImageMap[p.name.toLowerCase()] = p.images[0];
      }
      if (p.video_url) {
        productVideoMap[p.name.toLowerCase()] = p.video_url;
      }
    }

    // Build FAQ context with IDs so AI can report which ones it used
    const faqContext = faqs.map(f =>
      `[FAQ_ID:${f.id}] Q: ${f.question}\nA: ${f.answer}${f.products?.name ? ` (Related to: ${f.products.name})` : ""}`
    ).join("\n\n");

    // Get list of tracked FAQ IDs
    const trackedFaqIds = faqs.filter(f => f.is_tracked).map(f => f.id);

    const conversationContext = (conversationHistory as ConversationMessage[])
      .map(msg => `${msg.direction === "inbound" ? "Customer" : "Assistant"}: ${msg.message}`)
      .join("\n"); const systemPrompt = `You are the exclusive AI Gifting & Sales Advisor for Ceylona Gems & Jewelry (Sri Lanka).
Your objective is to qualify incoming customer leads, collect their gifting requirements step-by-step, recommend 2 to 3 matching configured products, and hand qualified leads over to our human sales team.

PRIMARY OBJECTIVE & BEHAVIOR (STRICT PRD POLICY):
- THIS IS A LEAD QUALIFICATION & CONSULTATION AGENT, NOT A SELF-SERVICE CHECKOUT BOT.
- NEVER ask the customer for their full name, phone number, shipping address, district/city, or payment method! Their WhatsApp number is already known.
- All delivery address collection and payment processing will be handled directly by our dedicated human sales agents during manual handoff.
- Plain text only. Do NOT use markdown asterisks (*bold* or **bold**). Use tasteful emojis (💎, ✨, 🎁, 📜, 🔹).
- STRICT ZERO-URL POLICY: NEVER EVER output website links, product URLs, domain names, or angle-bracketed URLs (<http...>) in the text! WhatsApp media is sent by the server, not via chat links. Only use exact catalog image URLs in <IMAGE_URL>url</IMAGE_URL> tags at the very END. If a product does not have an image in the catalog, DO NOT output any <IMAGE_URL> tag for it. NEVER fabricate, invent, or guess links!

CRITICAL RULE: STRICT DATA BOUNDARY & ZERO HALLUCINATION POLICY (ZERO TOLERANCE FOR INVENTED FACTS):
- ABSOLUTE CLOSED-WORLD TRUTH: You MUST STRICTLY and EXCLUSIVELY rely ONLY on the configured PRODUCT CATALOG and FREQUENTLY ASKED QUESTIONS provided below.
- NEVER invent, guess, fabricate, or assume unlisted products, gemstones, ring sizes, gold karats, custom discounts, return policies, delivery times, or gemstone treatments.
- CRITICAL PRODUCT CATALOG ADHERENCE (NO FABRICATED PRODUCTS / NO FABRICATED NAMES):
  👉 You may ONLY suggest gemstones and products that explicitly exist in the PRODUCT CATALOG below.
  👉 NEVER invent or suggest gemstones that are not in the catalog (e.g. NEVER suggest Blue Spinel, Ruby, Alexandrite, Rose Quartz, etc. if not listed in the catalog).
  👉 FLEXIBLE MATCH COUNT: If the customer requests a specific color or budget and only 1 or 2 matching gemstones exist in the catalog (e.g. for pink color, only Tourmaline exists), suggest ONLY those available items! NEVER invent extra items just to fill a count.
  👉 STRICT NAMING & PRICING FORMULA FOR GIFTING GEMSTONES (CATEGORY 1):
     • Use the EXACT gemstone name from the catalog (e.g. "Tourmaline", "Blue Sapphire", "Rose Pearl", "Aquamarine", "Emerald", "Amethyst", "Citrine", "Red Garnet", "White Topaz", "London Blue Topaz", "Swiss Blue Topaz", "Opal", "White Pearl").
     • Use the EXACT catalog price from the catalog (e.g. "Price: LKR 10,450"). NEVER invent arbitrary prices (like LKR 14,450).
     • STRICTLY FORBIDDEN: NEVER add adjectives or decorative words (e.g. DO NOT say "Natural Pink Tourmaline (Large)" or "Luxury Large"). Use ONLY the exact name from the catalog!
  👉 STRICT NAMING FORMULA FOR SILVER JEWELRY (RINGS & PENDANTS):
     • Use the EXACT gemstone name from the catalog followed by "Solid 925 Silver Ring" or "Solid 925 Silver Pendant" (e.g. "Blue Sapphire Solid 925 Silver Ring", "London Blue Topaz Solid 925 Silver Ring").
     • STRICTLY FORBIDDEN: NEVER add adjectives to the gemstone name (e.g. DO NOT say "Royal Blue Sapphire", "Natural Blue Sapphire", "Super Ceylon Emerald", or "Vivid Topaz"). Use ONLY the exact name from the catalog!
- UNKNOWN QUESTIONS / UNLISTED DETAILS HANDLING:
  If a customer asks a question, requests a product, or inquires about a detail that is NOT explicitly answered in the catalog or FAQs:
  👉 DO NOT guess or make up an answer.
  👉 Politely state that this specific detail or custom request will be verified and arranged directly by our dedicated sales team / master jeweler during handoff.
  • English Example: "I don't have that specific detail in our current catalog, but our dedicated sales agent will be happy to verify and arrange this for you directly on this chat! 💎"
  • Sinhala Example: "ඒ ගැන වැඩිදුර විස්තර අපේ sales team එකෙන් contact කරලා ඔයාට confirm කරලා දෙයි! 💎"
  • Tamil Example: "இந்த விபரம் எமது பட்டியலில் இல்லை, எனினும் எமது sales agent உங்களுடன் பேசி இதனை உறுதிப்படுத்துவார்! 💎"

CRITICAL RULE: ADAPTIVE LANGUAGE & TONE MIRRORING (CASUAL SPOKEN SINHALA / TAMIL / ENGLISH):
- Auto-detect the customer's language (Sinhala, English, or Tamil) AND their conversational style (Pure native words vs. Code-mixed with English).
- MANDATORY CASUAL EVERYDAY SPOKEN SINHALA (STRICTLY NO LITERARY / BOOKISH SINHALA):
  👉 When the customer communicates in Sinhala, you MUST ALWAYS use CASUAL, EVERYDAY SPOKEN CONVERSATIONAL SINHALA (දිනපතා කතා කරන සාමාන්‍ය කතාබහ / natural spoken Sri Lankan Sinhala).
  👉 STRICTLY FORBIDDEN: NEVER use formal literary, bookish, or archaic grammatical Sinhala (සාහිත්‍යමය සිංහල / ලේඛන ව්‍යවහාරය සම්පූර්ණයෙන්ම තහනම්).
     ❌ FORBIDDEN literary verb endings & phrases: 'කරනු ලැබේ', 'සිදු කෙරේ', 'ලැබෙන්නේය', 'භාණ්ඩය', 'මිලදී ගැනීම සඳහා', 'ඔබගේ', 'පැමිණේ', 'වන්නේය'.
     ✅ MANDATORY natural everyday spoken phrasing: 'කරන්නේ', 'කරනවා', 'වෙන්නේ', 'හම්බවෙන්නේ', 'ඔයාගේ', 'බලන්න පුළුවන්', 'කියන්නකෝ', 'කතා කරයි', 'ගලක්', 'මුද්දක්'.
  👉 Keep the tone warm, natural, friendly, and just like a polite Sri Lankan boutique advisor chatting directly with a customer on WhatsApp.

- MIRROR THE CUSTOMER'S STYLE DYNAMICALLY:
  👉 SCENARIO A — Customer speaks in PURE / NATIVE SINHALA (No English words used):
     • When the customer asks in pure Sinhala (e.g. "ගලක් බලන්න ආවේ", "මිල කීයද?", "ලැබෙන්නේ කවද්ද?", "මුද්දක් ගන්න ඕන"):
     • DO NOT insert English words into your response.
     • Reply in fluent, natural, polite Everyday Spoken Sinhala using proper terms (e.g. මිල, මැණික් ගල, මුද්ද, පෙන්ඩන්ට්, තෑග්ග, ලැබෙන දිනය, මිලට ඇතුළත් සහතිකය, තහවුරු කරන්න).
     • Pure Spoken Sinhala Example:
       "ආයුබෝවන්! 💎 Ceylona Gems & Jewelry වෙත සාදරයෙන් පිළිගන්නවා. ඔයාට උදව් වෙන්න පුළුවන් අංශ 3ක් තියෙනවා:
       1️⃣ තෑගි මැණික් ගල් (මිලට ඇතුළත් රජයේ සහතිකයක් එක්කම)
       2️⃣ රිදී ආභරණ (මුදු සහ පෙන්ඩන්ට්)
       3️⃣ තෑගි ඇසුරුම් සහ කාඩ්පත්
       ඔයා කැමති මොන අංශය ගැන බලන්නද? ✨"

  👉 SCENARIO B — Customer MIXES ENGLISH with Sinhala (Casual Singlish / Code-mixed):
     • When the customer mixes English words (e.g. "delivery fee කීයද?", "gemstone price එක කීයද?", "order එක confirm කරන්න", "budget එක"):
     • Mirror their casual style by naturally blending common English business terms into conversational Sinhala (e.g. Order, Delivery, Budget, Gemstone, Ring, Pendant, Size, Certificate, Details, Gift, Confirm, Sales team).
     • Code-Mixed Sinhala Example:
       "ආයුබෝවන්! 💎 Ceylona Gems & Jewelry වෙත සාදරයෙන් පිළිගන්නවා. ඔයාට උදව් කරන්න පුළුවන් options 3ක් තියෙනවා:
       1️⃣ Gifting Gemstone (Certificate එක price එකට included)
       2️⃣ Silver Jewelry (Rings & Pendants)
       3️⃣ Gift Packaging Options
       ඔයා කැමති මොන option එකටද? ✨"

CRITICAL PRICING, CERTIFICATE & DELIVERY POLICY (STRICT PRD RULES):
1. SILVER JEWELRY & RING PRICING RULE (GEMSTONE + BASE RING PRICE RANGE):
   • MANDATORY RING PRICING FORMULA:
     When giving a price for the Ring category (or when asked for ring prices):
     Total Ring Price = Gemstone Price + Base Ring Crafting / Silver Price.
     The price includes BOTH the precious gemstone AND the Solid 925 Silver base ring setting with master craftsmanship.
   • NEVER QUOTE A RIGID SINGLE FIXED PRICE FOR RINGS! ("ellathukum oru fix price solla venam"):
     Instead, ALWAYS provide an estimated PRICE RANGE based on the stone grade, carat weight, and base ring setting.
     👉 Example: A Swiss Blue Topaz Silver Ring typically comes in the range of LKR 14,950 – 22,950 (gemstone price + base ring crafting).
   • DESIGN VARIATION & FULL PRICE CONFIRMATION BY AGENT:
     ALWAYS clearly state that:
     1. The final price varies depending on the specific ring design, band thickness, and setting chosen ("design එක අනුව මිල වෙනස් වෙන්න පුළුවන්" / "design-க்கு ஏற்றவாறு விலை மாறும்").
     2. Our dedicated human sales agent will confirm the exact final full price directly with the customer on this chat ("අපේ sales agent ඔයා තෝරාගන්නා design එකට අදාළ සම්පූර්ණ අවසන් මිල confirm කරලා පවසනු ඇත" / "எமது sales agent நீங்கள் தெரிவுசெய்யும் design-க்குரிய முழுமையான இறுதி விலையை உறுதிப்படுத்தி கூறுவார்").
   • Handcrafted Solid 925 Silver pieces start from LKR 10,000+ (NEVER say rings start from LKR 4,400 as LKR 4,400 is only the loose gem price).
   • For Silver Jewelry Budget bracket step, ALWAYS present:
     🔹 LKR 10,000 – 20,000
     🔹 LKR 20,000 – 35,000
     🔹 Above LKR 35,000

2. GEMSTONE CERTIFICATE RULE (NO "FREE" WORDING):
   • DO NOT call the certificate "Free Certificate" (නොමිලේ සහතිකයක් / இலவச சான்றிதழ்).
   • ALWAYS explain that the official Government-Registered Gem Lab Certificate cost (worth LKR 1,500) is ALREADY INCLUDED IN THE GEMSTONE'S PRICE (Certificate එක gemstone price එකටම include කරලා තියෙන්නේ / சான்றிதழ் கட்டணம் கல்லின் விலையிலேயே சேர்க்கப்பட்டுள்ளது).

3. DELIVERY TIMELINE & DATE INQUIRIES (ZERO HALLUCINATION):
   • If a customer asks when their parcel will arrive, how many days delivery takes, or specific delivery timelines:
   • DO NOT guess or promise courier arrival dates!
   • State politely: The exact delivery schedule and courier dispatch timeline for your location will be verified and confirmed by our dedicated sales agent during handoff.

4. BULK PRICE LIST / "SEND ALL GEMSTONE PRICES" REQUESTS:
   • If a customer asks for all gemstone prices, full price list, or catalog price dump:
   • DO NOT dump the full catalog or list all items at once.
   • Suggest 2 to 3 top popular pieces with starting price ranges (e.g. Natural Blue Sapphire, London Blue Topaz, Natural Tourmaline) and ask which color or budget bracket they would like to explore.

CRITICAL RULE: MANDATORY RE-PROMPTING FOR MISSING DETAILS (ZERO TOLERANCE FOR MISSING FIELDS):
- You MUST collect ALL required details for the chosen category before recommending ANY products, confirming, or handing off.
- NEVER assume, skip, or fill "Not Specified" / "N/A" for any required field!
- Mandatory Checklist per Category:
  • Gifting Gemstone: [1] Category, [2] Budget Bracket, [3] Gemstone/Color, [4] Size (Small, Medium, Large), [5] Gift Recipient (Who is it for), [6] Required Delivery Date.
  • Silver Jewelry: [1] Jewelry Type (Ring/Pendant/Custom), [2] Ring Size (5–11 if ring), [3] Budget Bracket, [4] Gemstone/Color, [5] Gift Recipient, [6] Required Delivery Date.
  • Gift Packaging: [1] Packaging Option (from 5 configured options), [2] Gift Recipient, [3] Required Delivery Date.

- RE-PROMPT ENFORCEMENT (CRITICAL):
  If the customer gives an incomplete or partial response, YOU MUST IMMEDIATELY PAUSE AND RE-PROMPT SPECIFICALLY FOR THE MISSING DETAIL:
  👉 If customer gives delivery date (e.g. "25th of October") but DID NOT state who the gift is for:
     Reply: "Thank you for the date! Could you also please let me know who this special gift is for (e.g. wife, girlfriend, boyfriend, husband, mother, friend, myself)? 🎁"
  👉 If customer states who the gift is for (e.g. "For my wife") but DID NOT state the delivery date:
     Reply: "That is wonderful! 🎁 By what date do you need the gift delivered to make sure it arrives in time? 📅"
  👉 If customer states a color/gemstone but missed budget or size:
     Reply: "Great choice! To recommend the best options, what is your preferred budget bracket? (LKR 4,000–10,000 / 10,000–20,000 / Above 20,000) 💰"
  👉 If customer chooses silver ring but missed ring size:
     Reply: "What is your preferred US ring size (5–11)? 💍"
  👉 YOU ARE STRICTLY FORBIDDEN FROM SHOWING RECOMMENDATIONS OR HANDING OFF UNTIL EVERY MANDATORY FIELD IS COLLECTED!

MANDATORY STEP-BY-STEP QUALIFICATION PROGRESSION:

1. STEP 1 (Welcome & Category Discovery):
   If the customer started the chat (e.g. "hi", "hello"):
   Greet them warmly as Ceylona Gems & Jewelry AI Assistant and present our 3 main categories:
   1️⃣ Gifting Gemstone (Authentic Ceylon Gems with Certificate Included)
   2️⃣ Gemstone-Based Silver Jewelry (Solid 925 Rings & Pendants)
   3️⃣ Gift Packaging & Presentation Options
   Ask ONLY which category they are interested in exploring.

2. CATEGORY 1 WORKFLOW: GIFTING GEMSTONES (PRD Section 3.3)
   Follow this exact sequence and DO NOT jump ahead:
   • Step 2 (Budget ONLY):
     Ask ONLY preferred budget bracket:
     🔹 LKR 4,000 – 10,000
     🔹 LKR 10,000 – 20,000
     🔹 Above LKR 20,000
     (Do NOT ask color/gemstone yet! Wait for budget answer).
   • Step 3 (Gemstone Type / Color ONLY):
     Once budget is answered, ask preferred gemstone type or color (Tourmaline, Pearl, Red Garnet, Topaz, Amethyst, Citrine).
   • Step 4 (Gemstone Size ONLY):
     Ask what size gemstone they require: Small, Medium, Large, or Custom Luxury.
   • Step 5 (Recipient & Required Delivery Date - MUST COLLECT BOTH):
     Ask: "Who is this special gift for (e.g. wife, girlfriend, boyfriend, husband, mother, friend, myself), and by what date do you need it delivered? 🎁"
     (If only one is provided, re-prompt specifically for the missing one!).
     DO NOT SHOW PRODUCTS UNTIL BOTH ARE CLEARLY ANSWERED!
   • Step 6 (Product Recommendations):
     Once Budget, Gemstone/Color, Size, Recipient, and Required Date are ALL collected:
     Filter catalog and suggest matching configured gemstones (1 to 3 items based strictly on available catalog stones).
     Use the EXACT name from the catalog (e.g. "Tourmaline", "Rose Pearl") and EXACT catalog price (e.g. LKR 10,450).
     NEVER invent unlisted gemstones (e.g. NEVER suggest Rose Quartz, Pink Sapphire, etc.). If only 1 stone matches the requested color, suggest ONLY that 1 stone!
     Include registered gem lab certificate included notice (worth LKR 1,500 included in price).
     Include <IMAGE_URL> tags ONLY for products that have an image URL listed in the catalog (if a stone has no image listed, do NOT output any <IMAGE_URL> tag).
     Ask: "Which of these pieces do you like best to proceed with? ✨"
   • Step 7 (Piece Breakdown & Selection Confirmation):
     When customer chooses (e.g. "1", "2", "3", "Blue Sapphire"), show selected piece details (Name, Price, Romantic Description, Registered Lab Certificate included — NO delivery fees) and ask:
     "Does this look perfect to you? Would you like to confirm and proceed with your order for this piece? ✨"
     CRITICAL STRICT RULE: In Step 7, you are ONLY presenting details and asking for confirmation. NEVER output <QUALIFIED_LEAD_JSON> in Step 7! You MUST WAIT until Step 8 when the customer explicitly confirms!
   • Step 8 (Handoff & Lead Record):
     ONLY on customer explicit confirmation ("yes", "confirm", "ow", "hari", "proceed"):
     Send exact closing message:
     "Thank you! I have collected all your requirements. One of our dedicated sales agents will contact you shortly on this chat with further assistance to confirm your piece. ✨"
     Append <QUALIFIED_LEAD_JSON> at the very end.

3. CATEGORY 2 WORKFLOW: GEMSTONE-BASED SILVER JEWELRY (PRD Section 3.4)
   Follow this exact step-by-step sequence naturally (ask ONE question at a time):
   • Step 2 (Jewelry Type Selection):
     When customer selects Silver Jewelry (e.g. "2"):
     Present our main silver jewelry options:
     "In our Silver Jewelry collection, we offer handcrafted Solid 925 Silver pieces (starting from LKR 10,000+). 💍✨
     1️⃣ Solid 925 Silver Rings
     2️⃣ Solid 925 Silver Pendants
     3️⃣ Custom Gemstone-Mounted Pieces (Custom Goldsmithing)
     Which type of silver jewelry would you like to explore? 🔹"
     Ask ONLY this question.

   • Step 3 (Branching based on jewelry type):
     - IF CUSTOM GEMSTONE-MOUNTED PIECE / CUSTOM DESIGN (Option 3):
       1. Ask what custom style/gemstone they have in mind.
       2. Ask their preferred budget bracket (LKR 10,000–20,000 / 20,000–35,000 / Above 35,000).
       3. Ask who the gift is for and by what date they need it delivered (re-prompt if either is missing).
       4. Once collected, perform direct handoff:
          "Thank you! Our master jeweler and dedicated sales agent will personally assist you with your custom crafting, sizing, and gemstone mounting. One of our agents will contact you shortly on this chat with custom design options. ✨"
          Append <QUALIFIED_LEAD_JSON> with category: "Gemstone-Based Silver Jewelry (Custom Piece)", gemstone_type, budget, gift_recipient, required_date, interested_product: "Custom Handcrafted Piece", product_price: (budget amount).
     - IF RING (Option 1):
       Ask: "What is your preferred US ring size (5–11)? 💍"
     - IF PENDANT (Option 2):
       Proceed directly to Step 4.

   • Step 4 (Budget ONLY):
     Ask preferred budget bracket for Silver Jewelry:
     🔹 LKR 10,000 – 20,000
     🔹 LKR 20,000 – 35,000
     🔹 Above LKR 35,000
     (Do NOT ask gemstone color yet! Wait for budget answer).

   • Step 5 (Gemstone Type / Color ONLY):
     Once budget is answered, ask: "Which precious gemstone or color would you like set in your silver [ring/pendant]? (e.g. Blue Sapphire, Emerald, Tourmaline, Pearl, Topaz, Garnet, Amethyst, or dark/custom tone) 💎"

   • Step 6 (Recipient & Required Delivery Date - MUST COLLECT BOTH):
     Ask: "Who is this special gift for (e.g. wife, girlfriend, boyfriend, mother, friend, myself), and by what date do you need it delivered? 🎁"
     (If only one is provided, re-prompt specifically for the missing one!).
     DO NOT SHOW PRODUCTS UNTIL BOTH ARE CLEARLY ANSWERED!

   • Step 7 (Suggest Matching Silver Jewelry Options - MANDATORY):
     Once all details are collected:
     Suggest matching configured silver options from available catalog gemstones (1 to 3 options based strictly on catalog availability).
     If only 1 or 2 matching stones exist in the catalog for the requested color/budget (e.g. for blue color, only Blue Sapphire and London Blue Topaz exist), suggest ONLY those available! NEVER fabricate an unlisted stone (like Blue Spinel)!
     Use the exact gemstone name from the catalog: "[Exact Gemstone Name] Solid 925 Silver Ring" (e.g. "1️⃣ Blue Sapphire Solid 925 Silver Ring", "2️⃣ London Blue Topaz Solid 925 Silver Ring").
     👉 FOR RINGS: Quote price as an estimated PRICE RANGE (e.g. approx. LKR 14,950 – 22,950 depending on stone) rather than a rigid fixed price, explaining that the total ring price combines the gemstone price + base ring crafting charges.
     👉 State that the exact final price varies according to the chosen design, and our dedicated sales agent will confirm the full price.
     Include registered certificate included notice. Only include <IMAGE_URL> tag if the stone has an image listed in the catalog. If a stone has no image in the catalog, do NOT output any <IMAGE_URL> tag for it.
     Ask: "Which of these pieces do you like best to proceed with? ✨"
     DO NOT skip directly to handoff! You MUST show the recommended piece(s) first!

   • Step 8 (Show Piece Breakdown & Selection Confirmation - MANDATORY):
     When customer selects an item ("1", "2", "3", or piece name), present full details (Name, Ring Size, Price Range [Gemstone + Base Ring Crafting], note that design determines final price confirmed by agent, Certificate Included — NO delivery fees) and ask:
     "Does this look perfect to you? Would you like to confirm and proceed with your order for this piece? ✨"
     DO NOT skip this confirmation step!
     CRITICAL STRICT RULE: In Step 8, you are ONLY presenting details and asking for confirmation. NEVER output <QUALIFIED_LEAD_JSON> in Step 8! You MUST WAIT until Step 9 when the customer explicitly confirms!

   • Step 9 (Handoff & Lead Record):
     ONLY when customer confirms ("yes", "confirm", "ow", "hari"):
     Send exact closing message:
     "Thank you! I have collected all your requirements. One of our dedicated sales agents will contact you shortly on this chat with further assistance to confirm your piece. ✨"
     Append <QUALIFIED_LEAD_JSON> at the very end.

4. CATEGORY 3 WORKFLOW: GIFT PACKAGING & PRESENTATION OPTIONS (PRD Section 3.5 & 8)
   • Step 2 (Present 5 Configured Packaging Options):
     When customer selects Gift Packaging (e.g. "3"):
     Present exactly the 5 configured options:
     "We offer elegant gift packaging and presentation options for your special moments: 🎁✨
     1️⃣ Decorative gift boxes 
     2️⃣ Gem boxes 
     3️⃣ Standard / free packaging options 
     4️⃣ Letter cards 
     5️⃣ Additional paid packaging/card options where applicable 
     Which packaging or presentation option would you like to choose? 🎁"
     Ask ONLY this question.

   • Step 3 (Branching & Strict Boundary Handling):
     - IF CUSTOM / UNLISTED PACKAGING REQUESTED (e.g. hampers, chocolate additions, flower arrangements, unlisted boxes, special gift baskets, or anything outside the 5 options):
       👉 MANDATORY AGENT HANDOFF: Do NOT guess, invent, or negotiate unlisted packaging!
       1. Ask who the gift is for and by what date they need it delivered (re-prompt if missing).
       2. Hand off directly to sales agent:
          "Thank you! For custom packaging arrangements and special bespoke requests outside our standard collection, our dedicated sales agent will personally assist you with options and arrangements. One of our agents will contact you shortly on this chat. ✨"
          Append <QUALIFIED_LEAD_JSON> with category: "Gift Packaging & Presentation (Custom Request)", packaging_requested: (customer's requested packaging), gift_recipient, required_date, product_price: 0.
     - IF ONE OF THE 5 CONFIGURED OPTIONS SELECTED (1 to 5):
       Proceed to Step 4.

   • Step 4 (Recipient & Required Delivery Date - MUST COLLECT BOTH):
     Ask: "Who is this special gift for, and by what date do you need it delivered? 🎁"
     (If customer only provides one, re-prompt specifically for the missing one!).
     DO NOT CONFIRM OR HAND OFF UNTIL BOTH ARE ANSWERED!

   • Step 5 (Show Selected Packaging Breakdown & Request Confirmation):
     Show selected packaging details, price (or Free for standard packaging), and ask:
     "Does this look perfect to you? Would you like to confirm this packaging selection? ✨"

   • Step 6 (Handoff & Lead Record):
     ONLY on customer confirmation ("yes", "confirm", "ow", "hari"):
     Send exact closing message:
     "Thank you! I have collected all your requirements. One of our dedicated sales agents will contact you shortly on this chat with further assistance to confirm your packaging selection. ✨"
     Append <QUALIFIED_LEAD_JSON> with category: "Gift Packaging & Additional Items", packaging_requested, gift_recipient, required_date, product_price.

SELECTION DISAMBIGUATION & NUMBER RESOLUTION (CRITICAL):
- In product recommendation steps, when you list 2 or 3 numbered recommendations (e.g. "1. London Blue Topaz...", "2. Tourmaline...", "3. Blue Sapphire..."), the customer will often reply with just a number ("1", "2", "3"), ordinal ("1st", "2nd", "3rd"), or short name.
- YOU MUST IMMEDIATELY RESOLVE THE NUMBER TO THAT EXACT ITEM FROM YOUR IMMEDIATELY PRECEDING RECOMMENDATION MESSAGE:
  • "1" -> The 1st recommended item
  • "2" -> The 2nd recommended item
  • "3" -> The 3rd recommended item
- Proceed straight to present that item's Full Details and ask: "Does this look perfect to you? Would you like to confirm and proceed with your order for this piece? ✨"
- NEVER misinterpret "1", "2", or "3" as a category or budget when choosing a product!

FAQ KNOWLEDGE & ANSWERS:
- Official Government-Registered Gem Lab Certificate (worth LKR 1,500) is ALREADY INCLUDED in the gemstone's price for all gemstones.
- COD is temporarily paused to ensure delivery quality; Bank Transfer is available. Delivery fee is LKR 350.
- If customer asks any FAQ during the chat, answer in 1-2 lines and then continue the current step.

PRODUCT IMAGES & ZERO-URL ENFORCEMENT:
- WhatsApp media is handled strictly by the server. NEVER output any website links, domain names, or fake URLs in the message text!
- When recommending products, you may ONLY include verbatim image URLs from the product catalog inside <IMAGE_URL>exact_catalog_url</IMAGE_URL> tags at the very END of your response.
- CRITICAL: If a product has NO image in the catalog (e.g. Blue Sapphire has no image listed), DO NOT invent any URL and DO NOT output any <IMAGE_URL> tag for that product! No image will be sent for products without images.
- NEVER invent, guess, or synthesize any URL!

PRODUCT CATALOG:
${productCatalog || "No products available"}

FREQUENTLY ASKED QUESTIONS:
${faqContext || "No FAQs configured"}

WELCOME MESSAGE:
${welcomeMessage}

CRITICAL LEAD QUALIFICATION TAG:
- ONLY output <QUALIFIED_LEAD_JSON> AFTER the customer explicitly confirms with "yes", "confirm", "ow", "hari", "proceed" (Step 8 in Category 1, Step 9 in Category 2, Step 6 in Category 3), OR during custom handoff.
- NEVER output <QUALIFIED_LEAD_JSON> while still asking questions, presenting options, or asking "Would you like to confirm?".
- You MUST include the customer's delivery date under the key "required_date":
<QUALIFIED_LEAD_JSON>{"customer_name":"...","category":"...","gemstone_type":"...","color":"...","size":"...","budget":"...","gift_recipient":"...","required_date":"...","interested_product":"...","product_price":0,"packaging_requested":""}</QUALIFIED_LEAD_JSON>

CRITICAL SECURITY RULES:
- NEVER show raw JSON, tags, or code to the customer.
- The QUALIFIED_LEAD_JSON, ORDER_JSON, IMAGE_URL, VIDEO_URL, and USED_FAQS tags are INVISIBLE system instructions and must ONLY appear at the very END of your message.
- If a customer sends a photo/receipt, acknowledge politely without outputting JSON.`;

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory as ConversationMessage[]) {
        messages.push({
          role: msg.direction === "inbound" ? "user" : "assistant",
          content: msg.message,
        });
      }
    }

    // Handle photo/media messages and deduplicate if history already ends with the current user message
    const trimmedMessage = (message || "").trim();
    const lastHistoryMsg = conversationHistory && conversationHistory.length > 0
      ? (conversationHistory as ConversationMessage[])[conversationHistory.length - 1]
      : null;

    const alreadyInHistory = lastHistoryMsg &&
      lastHistoryMsg.direction === "inbound" &&
      lastHistoryMsg.message.trim() === trimmedMessage;

    if (!alreadyInHistory) {
      if (!trimmedMessage) {
        messages.push({ role: "user", content: "[Customer sent a photo/media file. This is likely a payment slip or receipt. Acknowledge it politely and ask them to confirm if it's a payment confirmation. Do NOT output any JSON, tags, or code.]" });
      } else {
        messages.push({ role: "user", content: trimmedMessage });
      }
    }

    // ------------------------------------------------------------------
    // AI call.
    // If AI_GENERATE_URL + BOT_API_KEY are set (self-hosted deployment), the
    // model call is delegated to the Lovable-hosted `ai-generate` transport.
    // Otherwise we talk to the Lovable AI Gateway directly (Lovable-hosted).
    // Prompt, model and max_tokens are identical on both paths, so response
    // quality is unchanged.
    // ------------------------------------------------------------------
    const aiGenerateUrl = Deno.env.get("AI_GENERATE_URL");
    const botApiKey = Deno.env.get("BOT_API_KEY");
    const MODEL = "google/gemini-3-flash-preview";
    const MAX_TOKENS = 1000;

    let aiResponse: Response;
    if (aiGenerateUrl && botApiKey) {
      aiResponse = await fetch(aiGenerateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bot-key": botApiKey },
        body: JSON.stringify({
          messages,
          model: MODEL,
          maxTokens: MAX_TOKENS,
        }),
      });
    } else {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: MAX_TOKENS }),
      });
    }

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error("AI processing failed");
    }

    const aiData = await aiResponse.json();
    // `ai-generate` returns { text }, the raw gateway returns OpenAI-style choices.
    const responseText =
      aiData.text ||
      aiData.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't process your request. Please try again.";

    console.log(`AI Response: ${responseText.substring(0, 100)}...`);

    // Extract used FAQ IDs and log tracked ones
    const usedFaqsMatch = responseText.match(/<USED_FAQS>([\s\S]*?)<\/USED_FAQS>/);
    const usedFaqIds: string[] = usedFaqsMatch
      ? usedFaqsMatch[1].split(",").map((id: string) => id.trim()).filter(Boolean)
      : [];
    if (usedFaqsMatch && trackedFaqIds.length > 0) {
      const usedIds = usedFaqIds;
      const trackedUsedIds = usedIds.filter((id: string) => trackedFaqIds.includes(id));

      if (trackedUsedIds.length > 0) {
        console.log(`Tracked FAQs used: ${trackedUsedIds.join(", ")} for phone ${phoneNumber}`);
        const usageLogs = trackedUsedIds.map((faqId: string) => ({
          faq_id: faqId,
          user_id: userId,
          phone_number: phoneNumber,
          sender_name: senderName || "Unknown",
        }));
        const { error: logError } = await supabase.from("faq_usage_logs").insert(usageLogs);
        if (logError) {
          console.error("Error logging FAQ usage:", logError);
        }
      }
    }

    // Check if the AI response contains order JSON
    let orderCreated = false;
    const orderJsonMatches = [...responseText.matchAll(/<ORDER_JSON>([\s\S]*?)<\/ORDER_JSON>/g)];
    for (const orderJsonMatch of orderJsonMatches) {
      if (ordersLimitReached) {
        console.log(`Orders limit reached for user ${userId}: ${ordersCount}/${ordersLimit}`);
      } else {
        try {
          const orderData = JSON.parse(orderJsonMatch[1]);
          console.log("Saving order to database:", JSON.stringify(orderData));

          // Deduplication: check if a similar order was created in the last 5 minutes
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recentOrders } = await supabase
            .from("orders")
            .select("id")
            .eq("user_id", userId)
            .eq("customer_phone", orderData.customer_phone || phoneNumber)
            .eq("total_amount", orderData.total_amount || 0)
            .gte("created_at", fiveMinAgo);

          if (recentOrders && recentOrders.length > 0) {
            console.log("Duplicate order detected, skipping creation. Existing:", recentOrders[0].id);
          } else {
            const { data: orderResult, error: orderError } = await supabase
              .from("orders")
              .insert({
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone || phoneNumber,
                whatsapp_phone: phoneNumber,
                district: orderData.district || null,
                customer_address: orderData.customer_address || null,
                order_items: orderData.order_items || [],
                payment_method: orderData.payment_method || "cod",
                total_amount: orderData.total_amount || 0,
                special_instructions: orderData.customer_email ? `Email: ${orderData.customer_email}` : null,
                status: "pending",
                user_id: userId,
              })
              .select()
              .single();

            if (orderError) {
              console.error("Error saving order:", orderError);
            } else {
              console.log("Order saved successfully:", orderResult.id);
              orderCreated = true;

              // Send order notification to owner
              try {
                const { data: notifSettings } = await supabase
                  .from("settings")
                  .select("value")
                  .eq("key", "order_notifications")
                  .eq("user_id", userId)
                  .single();

                const ownerPhone = notifSettings?.value?.phone;
                if (ownerPhone) {
                  const items = (orderData.order_items || [])
                    .map((item: any) => `${item.quantity}x ${item.name}`)
                    .join(", ");
                  const notifMessage = `📦 New Order #${orderResult.id.substring(0, 8)}\n👤 ${orderData.customer_name}\n📱 ${orderData.customer_phone || phoneNumber}\n🛒 ${items}\n💰 Total: ${orderData.total_amount}\n💳 ${orderData.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}${orderData.district ? `\n🏘️ District: ${orderData.district}` : ""}${orderData.customer_address ? `\n📍 ${orderData.customer_address}` : ""}`;

                  // Use the sessionApiKey passed from the webhook, fallback to DB lookup
                  let sendApiKey = sessionApiKey || null;
                  if (!sendApiKey) {
                    const { data: sessionData } = await supabase
                      .from("user_wsender_sessions")
                      .select("session_api_key")
                      .eq("user_id", userId)
                      .limit(1)
                      .maybeSingle();
                    sendApiKey = sessionData?.session_api_key || null;
                  }

                  const sendNotif = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-Ceylon_gems`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${supabaseServiceKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      to: ownerPhone,
                      message: notifMessage,
                      sessionApiKey: sendApiKey,
                    }),
                  });
                  if (!sendNotif.ok) {
                    console.error("Failed to send owner notification:", await sendNotif.text());
                  } else {
                    console.log("Owner notification sent to", ownerPhone);
                  }
                }
              } catch (notifError) {
                console.error("Error sending owner notification:", notifError);
              }
            }
          }
        } catch (parseError) {
          console.error("Error parsing order JSON:", parseError);
        }
      }
    }

    // Check if the AI response contains qualified lead JSON
    const leadJsonMatches = [...responseText.matchAll(/<QUALIFIED_LEAD_JSON>([\s\S]*?)<\/QUALIFIED_LEAD_JSON>/g)];
    for (const leadJsonMatch of leadJsonMatches) {
      try {
        const rawLeadData = JSON.parse(leadJsonMatch[1]);
        console.log("Saving qualified lead to database (raw):", JSON.stringify(rawLeadData));

        const custPhone = phoneNumber;
        const custName = rawLeadData.customer_name || senderName || "Interested Customer";

        // Normalize all possible JSON field name variations from LLM
        const category = rawLeadData.category || "Gifting Gemstone";
        const gemstoneType = rawLeadData.gemstone_type || rawLeadData.gemstone || rawLeadData.stone || rawLeadData.gem || "";
        const color = rawLeadData.color || rawLeadData.colour || rawLeadData.color_tone || "";
        const size = rawLeadData.size || rawLeadData.dimensions || rawLeadData.ring_size || "";
        const budget = rawLeadData.budget || rawLeadData.budget_bracket || rawLeadData.price_range || rawLeadData.budget_range || "";
        const giftRecipient = rawLeadData.gift_recipient || rawLeadData.recipient || rawLeadData.for_whom || rawLeadData.intended_recipient || "";
        const rawRequiredDate =
          rawLeadData.required_delivery_date ||
          rawLeadData.required_date ||
          rawLeadData.delivery_date ||
          rawLeadData.needed_by ||
          rawLeadData.delivery_by ||
          rawLeadData.target_date ||
          rawLeadData.date ||
          "";

        let requiredDate = rawRequiredDate ? String(rawRequiredDate).trim() : "";
        if (!requiredDate && conversationHistory && Array.isArray(conversationHistory)) {
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const hMsg = (conversationHistory[i] as any)?.message || "";
            const dateMatch = hMsg.match(/\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{2,4})?|\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/i);
            if (dateMatch) {
              requiredDate = dateMatch[0].trim();
              console.log(`[Date Resolver] Extracted required date from history: "${requiredDate}"`);
              break;
            }
          }
        }

        const packagingRequested = rawLeadData.packaging_requested || rawLeadData.packaging || "";
        const interestedProduct = rawLeadData.interested_product || rawLeadData.selected_product || rawLeadData.product_name || rawLeadData.product || (gemstoneType ? `${gemstoneType}${size ? ` (${size} Size)` : ""}` : "Ceylon Gem");

        // Resolve exact product price
        let actualPrice = 0;
        const rawPrice = rawLeadData.product_price ?? rawLeadData.price ?? rawLeadData.item_price ?? rawLeadData.amount;
        if (typeof rawPrice === "number" && rawPrice > 0) {
          actualPrice = rawPrice;
        } else if (typeof rawPrice === "string") {
          const matchP = rawPrice.replace(/,/g, "").match(/\d+(\.\d+)?/);
          if (matchP) actualPrice = parseFloat(matchP[0]);
        }

        // Search catalog if actualPrice is still 0
        if (actualPrice === 0 && (interestedProduct || gemstoneType)) {
          const searchKey = (interestedProduct || gemstoneType).toLowerCase();
          const prod = products.find((p: any) =>
            searchKey.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(searchKey)
          );
          if (prod) {
            actualPrice = prod.price || 0;
            if (prod.variations && Array.isArray(prod.variations)) {
              for (const v of prod.variations) {
                for (const opt of v.options || []) {
                  if (typeof opt === "object" && opt.label) {
                    const optLabel = opt.label.toLowerCase();
                    const sizeKey = size ? size.toLowerCase() : "";
                    if (sizeKey && optLabel.includes(sizeKey)) {
                      actualPrice = opt.price || actualPrice;
                    } else if (searchKey.includes(optLabel)) {
                      actualPrice = opt.price || actualPrice;
                    }
                  }
                }
              }
            }
          }
        }

        if (actualPrice === 0 && budget) {
          if (typeof budget === "number") {
            actualPrice = budget;
          } else if (typeof budget === "string") {
            const matchNum = budget.replace(/,/g, "").match(/\d+/);
            if (matchNum) actualPrice = parseFloat(matchNum[0]);
          }
        }

        const normalizedLeadData = {
          customer_name: custName,
          category,
          gemstone_type: gemstoneType,
          color,
          size,
          budget,
          gift_recipient: giftRecipient,
          required_date: requiredDate,
          packaging_requested: packagingRequested,
          interested_product: interestedProduct,
          product_price: actualPrice,
        };

        const formattedInstructions = [
          `🌟 QUALIFIED LEAD REQUIREMENT`,
          `💎 Category: ${category}`,
          gemstoneType ? `🔹 Gemstone / Style: ${gemstoneType}` : null,
          color ? `🎨 Color Tone: ${color}` : null,
          size ? `📏 Size / Dimensions: ${size}` : null,
          budget ? `💰 Budget Bracket: ${budget}` : null,
          giftRecipient ? `🎁 Gift Recipient: ${giftRecipient}` : null,
          requiredDate ? `📅 Required Date: ${requiredDate}` : null,
          packagingRequested ? `📦 Packaging: ${packagingRequested}` : null,
          interestedProduct ? `🛍️ Matched Product: ${interestedProduct}` : null,
          actualPrice > 0 ? `💵 Estimated / Product Price: LKR ${actualPrice.toLocaleString()}` : null,
        ].filter(Boolean).join("\n");

        const orderItemName = interestedProduct || `${gemstoneType || "Ceylon Gem"} (${category})`;
        const orderItemsPayload = [
          {
            name: orderItemName,
            price: actualPrice,
            quantity: 1,
            product_type: "physical",
            lead_details: normalizedLeadData,
          }
        ];

        // Deduplication / Session update: check if an order was created in last 2 hours for this phone
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: recentLeadOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("user_id", userId)
          .eq("customer_phone", custPhone)
          .gte("created_at", twoHoursAgo);

        let leadOrderId: string | null = null;
        let isUpdate = false;
        if (recentLeadOrders && recentLeadOrders.length > 0) {
          leadOrderId = recentLeadOrders[0].id;
          isUpdate = true;
          console.log("Updating existing recent order rather than creating duplicate:", leadOrderId);
          await supabase
            .from("orders")
            .update({
              customer_name: custName,
              total_amount: actualPrice > 0 ? actualPrice : undefined,
              special_instructions: formattedInstructions,
              order_items: orderItemsPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", leadOrderId);
        } else {
          const { data: leadOrderResult, error: leadOrderError } = await supabase
            .from("orders")
            .insert({
              customer_name: custName,
              customer_phone: custPhone,
              whatsapp_phone: phoneNumber,
              status: "qualified_lead",
              user_id: userId,
              payment_method: "bank_transfer",
              total_amount: actualPrice,
              special_instructions: formattedInstructions,
              order_items: orderItemsPayload,
            })
            .select()
            .single();

          if (leadOrderError) {
            console.error("Error creating qualified lead order:", leadOrderError);
          } else {
            leadOrderId = leadOrderResult.id;
          }
        }

        if (leadOrderId) {
          console.log("Qualified lead order saved successfully with price:", actualPrice, "order id:", leadOrderId);

          // Also upsert into Ceylon_gems.leads preserving existing custom_fields / flow_state
          try {
            const { data: existingLead } = await supabase
              .from("leads")
              .select("custom_fields")
              .eq("user_id", userId)
              .eq("phone_number", custPhone)
              .maybeSingle();

            await supabase
              .from("leads")
              .upsert({
                user_id: userId,
                phone_number: custPhone,
                customer_name: custName,
                status: "qualified",
                custom_fields: {
                  ...(existingLead?.custom_fields || {}),
                  ...normalizedLeadData,
                  product_price: actualPrice,
                  is_qualified: true,
                },
              }, { onConflict: "user_id,phone_number" });
          } catch (leadUpsertErr) {
            console.warn("Could not upsert into leads table:", leadUpsertErr);
          }

          // Send notification to business owner / staff ONLY IF NEW LEAD (prevent duplicate notification)
          if (!isUpdate) {
            try {
              const { data: notifSettings } = await supabase
                .from("settings")
                .select("value")
                .eq("key", "order_notifications")
                .eq("user_id", userId)
                .single();

              const ownerPhone = notifSettings?.value?.phone;
              if (ownerPhone) {
                const notifMessage = `🌟 *NEW QUALIFIED LEAD!*\n\n👤 *Customer:* ${custName}\n📱 *Phone:* ${custPhone}\n💎 *Category:* ${category}\n🔹 *Item/Gem:* ${gemstoneType || interestedProduct}\n📏 *Size:* ${size || "N/A"}\n💰 *Budget:* ${budget || "N/A"}\n🎁 *Recipient:* ${giftRecipient || "N/A"}\n📅 *Required Date:* ${requiredDate || "N/A"}\n💵 *Price:* LKR ${actualPrice.toLocaleString()}\n📦 *Packaging:* ${packagingRequested || "N/A"}\n\n👉 *Reply directly on WhatsApp to close this sale!*`;

                let sendApiKey = sessionApiKey || null;
                if (!sendApiKey) {
                  const { data: sessionData } = await supabase
                    .from("user_wsender_sessions")
                    .select("session_api_key")
                    .eq("user_id", userId)
                    .limit(1)
                    .maybeSingle();
                  sendApiKey = sessionData?.session_api_key || null;
                }

                await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-Ceylon_gems`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${supabaseServiceKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    to: ownerPhone,
                    message: notifMessage,
                    sessionApiKey: sendApiKey,
                  }),
                });
                console.log("Owner notification sent to", ownerPhone);
              }
            } catch (notifErr) {
              console.warn("Error sending owner lead notification:", notifErr);
            }
          } else {
            console.log(`Skipping duplicate owner notification since lead order ${leadOrderId} was already notified recently.`);
          }
        }
      } catch (leadParseErr) {
        console.error("Error parsing qualified lead JSON:", leadParseErr);
      }
    }

    // Resolve FAQ attachments: only for FAQs the AI actually used, first time per conversation,
    // max 4 attachments in one reply.
    let faqMedia: string[] = [];
    if (usedFaqIds.length > 0) {
      const candidates: string[] = [];
      for (const id of usedFaqIds) {
        const faq = faqs.find((f: any) => f.id === id);
        const urls = Array.isArray(faq?.media_urls) ? faq!.media_urls : [];
        for (const u of urls) {
          if (typeof u === "string" && u.trim() && !candidates.includes(u)) candidates.push(u);
        }
      }

      if (candidates.length > 0) {
        // Skip anything already sent to this customer before
        const { data: priorRows } = await supabase
          .from("conversations")
          .select("metadata")
          .eq("user_id", userId)
          .eq("phone_number", phoneNumber)
          .eq("direction", "outbound")
          .not("metadata", "is", null)
          .order("created_at", { ascending: false })
          .limit(200);

        const alreadySent = new Set<string>();
        for (const row of priorRows || []) {
          const sent = (row as any)?.metadata?.faqMedia;
          if (Array.isArray(sent)) sent.forEach((u: string) => alreadySent.add(u));
        }

        faqMedia = candidates.filter((u) => !alreadySent.has(u)).slice(0, 4);
        if (faqMedia.length > 0) {
          console.log(`FAQ attachments to send (${faqMedia.length}): ${faqMedia.join(", ")}`);
        }
      }
    }

    // Build set of valid, genuine catalog image URLs from database
    const validCatalogImageUrls = new Set<string>();
    for (const p of products) {
      if (p.images && Array.isArray(p.images)) {
        for (const img of p.images) {
          if (typeof img === "string" && img.trim().startsWith("http")) {
            validCatalogImageUrls.add(img.trim());
          }
        }
      }
    }

    // Extract image URLs if present in tags
    const rawImageUrlMatches = Array.from(responseText.matchAll(/<IMAGE_URL>([\s\S]*?)<\/IMAGE_URL>/g));
    const rawImageUrls = rawImageUrlMatches.map(m => m[1].trim()).filter(Boolean);

    // Whitelist filter: ONLY allow URLs that genuinely exist in our catalog/storage!
    const validatedImageUrls: string[] = [];
    for (const rawUrl of rawImageUrls) {
      if (validCatalogImageUrls.has(rawUrl) && !validatedImageUrls.includes(rawUrl)) {
        validatedImageUrls.push(rawUrl);
      } else {
        console.warn(`[Image Whitelist] Discarding invalid/hallucinated image URL: ${rawUrl}`);
      }
    }

    // Fallback: If AI recommended products but didn't provide valid <IMAGE_URL> tags,
    // match recommended product names against catalog products that DO have genuine images.
    if (validatedImageUrls.length === 0) {
      for (const p of products) {
        if (p.images && Array.isArray(p.images) && p.images.length > 0 && p.images[0]?.trim()) {
          const pNameRegex = new RegExp(`\\b${p.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i");
          if (pNameRegex.test(responseText)) {
            const firstImg = p.images[0].trim();
            if (validCatalogImageUrls.has(firstImg) && !validatedImageUrls.includes(firstImg)) {
              console.log(`[Image Match] Auto-matched catalog image for "${p.name}": ${firstImg}`);
              validatedImageUrls.push(firstImg);
            }
          }
        }
      }
    }

    const imageUrls = validatedImageUrls;
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
    // Extract video URL if present
    const videoUrlMatch = responseText.match(/<VIDEO_URL>([\s\S]*?)<\/VIDEO_URL>/);
    const videoUrl = videoUrlMatch ? videoUrlMatch[1].trim() : null;

    // Aggressively strip any JSON or technical markup from the response
    let cleanResponse = responseText;
    // Remove complete tagged blocks WITH their content first
    cleanResponse = cleanResponse.replace(/<QUALIFIED_LEAD_JSON>[\s\S]*?<\/QUALIFIED_LEAD_JSON>/g, "");
    cleanResponse = cleanResponse.replace(/<ORDER_JSON>[\s\S]*?<\/ORDER_JSON>/g, "");
    cleanResponse = cleanResponse.replace(/<IMAGE_URL>[\s\S]*?<\/IMAGE_URL>/g, "");
    cleanResponse = cleanResponse.replace(/<VIDEO_URL>[\s\S]*?<\/VIDEO_URL>/g, "");
    cleanResponse = cleanResponse.replace(/<USED_FAQS>[\s\S]*?<\/USED_FAQS>/g, "");
    // Remove truncated/incomplete tags and everything after them
    cleanResponse = cleanResponse.replace(/<QUALIFIED_LEAD_JSON>[\s\S]*/g, "");
    cleanResponse = cleanResponse.replace(/<ORDER_JSON>[\s\S]*/g, "");
    cleanResponse = cleanResponse.replace(/<IMAGE_URL>[\s\S]*/g, "");
    cleanResponse = cleanResponse.replace(/<VIDEO_URL>[\s\S]*/g, "");
    cleanResponse = cleanResponse.replace(/<USED_FAQS>[\s\S]*/g, "");
    // Remove any remaining orphan uppercase XML-like tags
    cleanResponse = cleanResponse.replace(/<\/?[A-Z_]+>/g, "");
    // Remove fenced code blocks (```json ... ``` or ``` ... ```)
    cleanResponse = cleanResponse.replace(/```[\s\S]*?```/g, "");
    // Remove any JSON object that looks like order data (greedy match for nested objects)
    cleanResponse = cleanResponse.replace(/\{[^{}]*"customer_name"[^}]*\}/g, "");
    cleanResponse = cleanResponse.replace(/\{[^{}]*"customername"[^}]*\}/g, ""); // catch typos from model
    cleanResponse = cleanResponse.replace(/\{[^{}]*"order_items"[^}]*\}/g, "");
    cleanResponse = cleanResponse.replace(/\{[^{}]*"payment_method"[^}]*\}/g, "");
    cleanResponse = cleanResponse.replace(/\{[^{}]*"total_amount"[^}]*\}/g, "");
    cleanResponse = cleanResponse.replace(/\{[^{}]*"gemstone_type"[^}]*\}/g, "");
    cleanResponse = cleanResponse.replace(/\{[^{}]*"interested_product"[^}]*\}/g, "");
    cleanResponse = cleanResponse.replace(/\{[^{}]*"gift_recipient"[^}]*\}/g, "");
    // Remove any remaining JSON-like structures with 2+ key-value pairs
    cleanResponse = cleanResponse.replace(/\{\s*"[^"]+"\s*:[\s\S]*?\}/g, "");
    // Aggressively remove ANY angle-bracketed URLs (<http...>), markdown links [text](http...), or naked web links
    cleanResponse = cleanResponse.replace(/<https?:\/\/[^>]+>/gi, "");
    cleanResponse = cleanResponse.replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/gi, "$1");
    cleanResponse = cleanResponse.replace(/https?:\/\/[^\s\)\>]+/gi, "");
    // Convert markdown double asterisks (**bold**) to WhatsApp single asterisk (*bold*)
    cleanResponse = cleanResponse.replace(/\*\*([^*]+)\*\*/g, "*$1*");
    // Remove standalone UUIDs that leak from FAQ IDs or correlation IDs
    cleanResponse = cleanResponse.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "");
    // Remove [FAQ_ID:...] references that may leak into response
    cleanResponse = cleanResponse.replace(/\[FAQ_ID:[^\]]*\]/g, "");
    // Clean up leftover whitespace
    cleanResponse = cleanResponse.replace(/\n{3,}/g, "\n\n").trim();

    // Log AI usage independently of conversations
    await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      phone_number: contactKey || phoneNumber,
    });

    // If an order was created, check for follow-up message
    let followupMessage: string | null = null;
    if (orderCreated) {
      try {
        const { data: followupSettings } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "order_followup_message")
          .eq("user_id", userId)
          .single();

        if (followupSettings?.value?.enabled && followupSettings?.value?.text?.trim()) {
          followupMessage = followupSettings.value.text.trim();
          console.log("Order follow-up message will be sent");
        }
      } catch (e) {
        console.warn("Could not fetch order followup setting:", e);
      }
    }

    return new Response(
      JSON.stringify({ response: cleanResponse, imageUrl, imageUrls, videoUrl, followupMessage, faqMedia }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Chat error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
