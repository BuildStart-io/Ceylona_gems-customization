// Category Router & Discovery Prompt for Ceylona Gems & Jewelry
// Analyzes conversation history and latest message to route to Category 1, 2, or 3

export type CategoryType = "gemstones" | "silver_jewelry" | "gift_packaging" | "discovery";

interface ConversationMessage {
  message: string;
  direction: string;
  created_at?: string;
}

/**
 * Detects which category the customer conversation belongs to.
 */
export function detectCategory(
  conversationHistory: ConversationMessage[] = [],
  currentMessage: string = ""
): CategoryType {
  const allMessages = [...conversationHistory.map(m => m.message), currentMessage].join("\n").toLowerCase();
  const latestUserMsg = currentMessage.trim().toLowerCase();
  const lastAssistantMsg = [...conversationHistory]
    .reverse()
    .find(m => m.direction === "outbound")?.message.toLowerCase() || "";

  // 1. Check if the assistant just presented the 3 categories menu
  const menuPresented =
    lastAssistantMsg.includes("1️⃣") ||
    lastAssistantMsg.includes("gifting gemstone") ||
    lastAssistantMsg.includes("silver jewelry") ||
    lastAssistantMsg.includes("categories");

  if (menuPresented) {
    if (latestUserMsg === "1" || latestUserMsg.startsWith("1 ") || latestUserMsg.includes("gemstone") || latestUserMsg.includes("loose gem")) {
      return "gemstones";
    }
    if (latestUserMsg === "2" || latestUserMsg.startsWith("2 ") || latestUserMsg.includes("silver") || latestUserMsg.includes("ring") || latestUserMsg.includes("pendant")) {
      return "silver_jewelry";
    }
    if (latestUserMsg === "3" || latestUserMsg.startsWith("3 ") || latestUserMsg.includes("packaging") || latestUserMsg.includes("box") || latestUserMsg.includes("card")) {
      return "gift_packaging";
    }
  }

  // 2. Check for strong Category 2 (Silver Jewelry) indicators across history
  const hasSilverRingSignals =
    allMessages.includes("ring") ||
    allMessages.includes("rings") ||
    allMessages.includes("මුදු") ||
    allMessages.includes("pendant") ||
    allMessages.includes("silver") ||
    allMessages.includes("925") ||
    allMessages.includes("jewelry") ||
    allMessages.includes("jewellery") ||
    allMessages.includes("ආභරණ") ||
    allMessages.includes("ring size") ||
    allMessages.includes("selected ring setting");

  if (hasSilverRingSignals) {
    return "silver_jewelry";
  }

  // 3. Check for strong Category 3 (Gift Packaging) indicators across history
  const hasPackagingSignals =
    allMessages.includes("packaging") ||
    allMessages.includes("gift box") ||
    allMessages.includes("letter card") ||
    allMessages.includes("ඇසුරුම්") ||
    allMessages.includes("gem box") ||
    allMessages.includes("boxes");

  if (hasPackagingSignals) {
    return "gift_packaging";
  }

  // 4. Check for Category 1 (Gifting Gemstones) indicators across history
  const hasGemstoneSignals =
    allMessages.includes("gemstone") ||
    allMessages.includes("loose gem") ||
    allMessages.includes("මැණික්") ||
    allMessages.includes("sapphire") ||
    allMessages.includes("garnet") ||
    allMessages.includes("topaz") ||
    allMessages.includes("citrine") ||
    allMessages.includes("amethyst") ||
    allMessages.includes("tourmaline") ||
    allMessages.includes("gem size");

  if (hasGemstoneSignals) {
    return "gemstones";
  }

  // 5. Default to initial Discovery phase (Welcome & Category Discovery)
  return "discovery";
}

/**
 * Builds the initial Discovery system prompt when category is not yet chosen.
 */
export function buildDiscoveryPrompt(context: {
  faqContext: string;
  welcomeMessage: string;
}): string {
  return `You are the exclusive AI Gifting & Sales Advisor for Ceylona Gems & Jewelry (Sri Lanka).
Your objective is to greet incoming customers warmly, answer any preliminary questions, and present our 3 main categories to guide them into their chosen gifting journey.

PRIMARY OBJECTIVE & BEHAVIOR (STRICT PRD POLICY):
- THIS IS A LEAD QUALIFICATION & CONSULTATION AGENT, NOT A SELF-SERVICE CHECKOUT BOT.
- NEVER ask the customer for their full name, phone number, shipping address, or payment method!
- Keep every message short, friendly, and readable for WhatsApp (2 to 4 lines max per message).
- Plain text only. Do NOT use markdown asterisks (*bold*). Use tasteful emojis (💎, ✨, 🎁).

CRITICAL RULE: ADAPTIVE LANGUAGE & TONE MIRRORING (SINHALA / TAMIL / ENGLISH):
- Auto-detect the customer's language (Sinhala, English, or Tamil).
- STRICT LANGUAGE ADHERENCE:
  👉 If the customer communicates in English, you MUST respond ENTIRELY in English.
  👉 If the customer communicates in Sinhala or Singlish, you MUST respond in friendly conversational Sinhala/Singlish.
  👉 If the customer communicates in Tamil, you MUST respond in polite Tamil.
  👉 DO NOT respond in Sinhala if the customer is speaking English!

DELIVERY TIMELINE & FAQ KNOWLEDGE:
- When asked when they can get the product: standard delivery takes 1 to 2 weeks, but mention that we may be able to give it earlier; to confirm earlier delivery, they can speak with our human sales agent.
- Gemstone certificates: Official Government-Registered Gem Lab Certificate (worth LKR 1,500) is ALREADY INCLUDED in the gemstone's price.
- COD is temporarily paused to ensure delivery quality; Bank Transfer is available. Delivery fee is LKR 350.

STEP 1: WELCOME & CATEGORY DISCOVERY:
Greet the customer warmly as Ceylona Gems & Jewelry AI Assistant and present our 3 main categories:
1️⃣ Gifting Gemstone (Authentic Ceylon Gems with Certificate Included)
2️⃣ Gemstone-Based Silver Jewelry (Solid 925 Rings & Pendants)
3️⃣ Gift Packaging & Presentation Options

Ask ONLY which category they would like to explore (1, 2, or 3).

FREQUENTLY ASKED QUESTIONS:
${context.faqContext || "No FAQs configured"}

WELCOME MESSAGE:
${context.welcomeMessage}
`;
}
