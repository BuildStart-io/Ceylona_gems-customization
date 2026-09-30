# Ceylona Gems & Jewelry — Customization & Implementation Plan
**Client:** Ceylona Gems and Jewelry  
**Service Provider:** BuildStart  
**Document Version:** v1.1 (Updated with Pricing Strategy & Starter Package Lead Architecture)  
**Target Environment:** BuildStart Self-Hosted (`Ceylon_gems` schema)  
**Status:** Architecture & Implementation Blueprint (No Code Changes Phase)

---

## 1. Executive Summary & PRD Scope

Ceylona Gems and Jewelry is a gift-focused business specializing in:
1. **Gifting Gemstones** (Standard & Premium gemstone gifts)
2. **Gemstone-Based Silver Jewelry** (Rings & Pendants)
3. **Gift Packaging & Accessories** (Gem boxes, decorative gift boxes, letter cards)

### Core Business Objectives:
- **Lead Capture:** Automatically handle 24/7 inbound inquiries arriving from **Facebook and TikTok ads** into WhatsApp.
- **AI Qualification:** Politely greet the customer, deliver an AI voice-note introduction, gather gift preferences step-by-step, and recommend matching items.
- **Strict 20-Product Catalog Boundary:** Out of ~90 total items, the AI chatbot is restricted to **20 curated products**. Anything outside this catalog must never be guessed; requirements are recorded and routed to a human specialist.
- **Strategic Pricing Disclosure:** The bot must **never reveal individual product prices upfront**. Instead, it introduces the broad range (LKR 4,400 to 1.5 Lakhs) and guides the customer into 3 distinct budget brackets.
- **Starter Package Lead Architecture:** Because Ceylona Gems is on the **Starter Package** (where the dedicated Growth Leads CRM tab is gated), qualified leads will be surfaced directly in the **Orders Tab** with a `🌟 Qualified Lead` badge and highlighted with a `💎 Qualified Lead` badge in the **Conversations Tab**.

---

## 2. Category-Wise Deep Analysis & Distinct Chat Flows

The PRD defines three distinct product categories plus an out-of-catalog fallback. Each category requires unique qualification questions, attribute matching, and handoff criteria.

```
                            [Customer First Message]
                                       │
                                       ▼
                     [Step 1: Welcome Message + Voice Note]
                                       │
                                       ▼
                   [Step 2: Identify Product Category]
                                       │
     ┌─────────────────────────────────┼─────────────────────────────────┐
     ▼                                 ▼                                 ▼
【CATEGORY 1】                   【CATEGORY 2】                    【CATEGORY 3】
Gifting Gemstones             Silver Jewelry                 Gift Packaging / Cards
(Loose Gemstones)             (Rings & Pendants)             (Add-on or Standalone)
     │                                 │                                 │
     ├─► Gemstone type/color           ├─► Jewelry Type (Ring/Pendant)   ├─► Box/Card type
     ├─► Size tier (1/2/3)             ├─► Gemstone & Color              ├─► Free vs Paid options
     ├─► Budget range (3 Tiers)        ├─► Ring Size (if Ring)           ├─► Recipient/Occasion
     ├─► Recipient & Date              ├─► Budget range (3 Tiers)        └─► Required Date
     │                                 ├─► Customization? (Gold/Design)
     │                                 │    └─► YES: Direct Agent Handoff
     │                                 └─► Recipient & Date
     │                                         │
     └─────────────────┬───────────────────────┘
                       ▼
         [Cross-Sell: Packaging / Letter Card]
                       │
                       ▼
         [Step 4: Recommend 2–3 Configured Products]
         (Send configured prices, specs, and <IMAGE_URL>)
                       │
                       ▼
         [Step 5: Customer Shows Interest ➔ Qualification]
         (Generate <QUALIFIED_LEAD_JSON> tag)
                       │
                       ▼
         [Step 6: Human Agent Handoff & Dual Badge Creation]
         (Creates "🌟 Qualified Lead" in Orders Tab + Badges Chat in Conversations)
```

---

### Category 1: Gifting Gemstones (Loose Stones)

#### Characteristics:
- Contains **12 standard gemstone types** (e.g., Blue Sapphire, Yellow Sapphire, Ruby, Garnet, Amethyst, Topaz, Peridot, etc.) and **5 high-range / premium gemstone types** (e.g., Padparadscha, Royal Blue Sapphire, Star Ruby, Certified Alexandrite, etc.).
- Multiple color shades per gemstone type.
- **Size Options:** Standard gemstones offer approximately **3 size options** (e.g., 0.5–1.0 ct, 1.0–2.0 ct, 2.0+ ct or small/medium/large dimensions). Premium gemstones offer 2 to 3 tiers based on availability.

#### Distinct Chat Flow for Gemstones:
1. **Gemstone Type / Color Discovery:**
   - *"Are you looking for a specific gemstone like a Sapphire or Ruby, or do you have a favorite color in mind?"*
2. **Size Preference Collection:**
   - *"What size would you prefer for the gemstone? (We usually have Petite/Delicate, Medium Classic, and Statement sizes)."*
3. **Budget Tier Selection (Strategic Pricing):**
   - Present the 3 budget brackets (LKR 4,000–10,000 | LKR 10,000–20,000 | Above LKR 20,000).
4. **Occasion, Recipient & Date:**
   - *"Who is this special gift for, and by when do you need it?"*
5. **Recommendation:**
   - Match against the configured gemstone items (matching type, color tier, size tier, and selected budget).
   - Present **2–3 options max** with clear pricing and image previews.
6. **Cross-Sell Hook:**
   - *"Would you like a specialized Gem Presentation Box or a gift card included with this?"*

---

### Category 2: Gemstone-Based Silver Jewelry

#### Characteristics:
- Gemstones mounted on 925 sterling silver settings.
- Primary subcategories:
  - **Silver Rings**
  - **Silver Pendants**
  - Other client-provided gemstone jewelry.
- Requires specialized sizing handling: **Ring sizes** require standard sizing (e.g., US size 6, 7, 8 or circumference guidance), whereas pendants are generally free-size.

#### Distinct Chat Flow for Silver Jewelry:
1. **Jewelry Type Identification:**
   - *"Are you interested in an elegant Silver Ring or a Gemstone Pendant?"*
2. **Gemstone & Color Selection:**
   - *"Which gemstone or color accent would you love on the jewelry?"*
3. **Sizing Inquiry (Rings only):**
   - If Ring: *"Do you happen to know the required ring size, or would you like our quick size measurement guide?"*
   - If Pendant: Skip ring size; ask about chain/pendant style preference.
4. **Budget Tier & Timeline:**
   - Present the 3 budget brackets and collect the target gift date.
5. **Custom Design / Boundary Detection (CRITICAL BRANCH):**
   - If the customer asks for custom goldsmithing, 18k gold plating, platinum, or custom engraving outside the 20 products:
     - 🛑 **Do NOT guess.**
     - Collect specifications and trigger immediate agent handoff:
     - *"That sounds like a beautiful custom piece! Our master jeweler handles custom designs personally. Let me connect you directly."*
6. **Recommendation:**
   - Recommend 2–3 matching configured silver jewelry items with images and prices.
7. **Packaging Add-on:**
   - *"Would you like our decorative velvet jewelry gift box or a personalized message card?"*

---

### Category 3: Gift Packaging & Additional Items

#### Characteristics:
- Can occur as an **independent inquiry** (e.g., a customer just wanting packaging) or as an **integrated add-on** at the end of Category 1 or Category 2 flows.
- Items include:
  - Decorative gift boxes
  - Gem boxes (acrylic/cushioned display boxes for loose stones)
  - Standard packaging (Free / basic packaging)
  - Custom handwritten letter cards (Paid / add-on)

#### Strict Business Rules:
- **Price Transparency:** Never assume packaging is free. Free options must be explicitly presented as free, and paid options (e.g., luxury wooden box or customized letter card) must list their exact configured price.
- **Workflow:**
  - When customer agrees to packaging, add the item and price to the lead's requirement profile.

---

### Category 4: Products Outside the 20-Product Catalog (Exception Flow)

#### Characteristics:
- The client has 90+ total items, but the bot is strictly capped at 20 products.
- Customers frequently ask for stones, jewelry types, or packaging outside the 20 featured items.

#### Strict Bot Behavior:
1. **Never Hallucinate / Guess:** Do not invent prices, gemstone varieties, or stock availability.
2. **Requirement Capture:** Ask what they are looking for and record:
   - Specific product requested
   - Target budget
   - Target date
3. **Seamless Referral:**
   - Inform the customer: *"We have an extensive vault collection beyond our featured 20 items. I've noted your request, and our sales specialist will check our complete inventory for you shortly!"*
4. **Mark Status:** Mark lead as `Agent Follow-Up Required` and notify sales staff.

---

## 3. Pricing Strategy & Budget Anchoring (Crucial Business Rules)

To protect sales conversion and prevent price shopping, the bot must follow this strict two-tier pricing disclosure strategy:

### Rule 1: No Premature Individual Prices Upfront
- When a customer asks: *"How much is this?"*, *"Price list tharungal"*, or *"What are your prices?"* before requirements are collected:
- **DO NOT** blurt out individual product prices immediately.
- **INSTEAD**, state the wide brand spectrum and pivot back to requirement discovery:
  > *"We have a wide range of gifting options starting from LKR 4,400 to LKR 10,000, and all the way up to 1.5 Lakhs for rare premium gemstones and custom fine jewelry. ✨*  
  > *Please let us know what type of gift or gemstone you have in mind, and we will find the most suitable options tailored for you!"*

### Rule 2: Three Intuitive Budget Guidance Brackets
When asking the customer for their budget range, the bot should present three clean, structured brackets so the customer feels comfortable picking an option:
1. 🔹 **Tier 1 (Entry / Gift Packs):** `LKR 4,000 – LKR 10,000`  
   *(Ideal for natural birthstones, delicate topaz/garnet, silver pendants, curated gift packs)*
2. 🔹 **Tier 2 (Mid-Range / Classic Gifts):** `LKR 10,000 – LKR 20,000`  
   *(Ideal for natural Ceylon blue sapphires, yellow sapphires, silver solitaire rings, presentation gem boxes)*
3. 🔹 **Tier 3 (Premium / Statement Gifts):** `Above LKR 20,000`  
   *(Ideal for high-carat certified gems, Padparadscha, luxury rings, custom goldsmithing pieces up to 1.5 Lakhs)*

This anchors the customer, eliminates price confusion, and allows the AI to filter matching products strictly within their chosen bracket.

---

## 4. Starter Package Architecture: Qualified Leads via Orders Tab & Chat Badging

### The Architectural Problem:
- In BuildStart, the dedicated **Leads CRM tab** (`/dashboard/leads`) is gated for the **Growth / Enterprise** subscription packages.
- Ceylona Gems and Jewelry is on the **Starter Package** (as specified in PRD Section 7).
- Therefore, the client will **not** be using the Growth Leads page.

### The Elegant Solution:
We integrate the qualification flow directly into the **Orders Tab (`/dashboard/orders`)** and the **Conversations Tab (`/dashboard/conversations`)**, which are 100% available on the Starter Package!

```
[Customer Chat Qualifies on WhatsApp]
                  │
                  ▼
   [ai-chat emits <QUALIFIED_LEAD_JSON>]
                  │
                  ▼
    [process-message-Ceylon_gems]
                  │
      ┌───────────┴────────────────────────┐
      ▼                                    ▼
[Insert into `orders` Table]     [Insert into `conversations`]
• status: 'qualified_lead'       • metadata: { is_qualified: true }
• total_amount: Budget midpoint  • Auto-tags thread
• special_instructions: Full     • WhatsApp Alert to Sales Agent
  Ceylona Requirement Sheet
      │                                    │
      ▼                                    ▼
【Orders Tab (Orders.tsx)】        【Chat Tab (Conversations.tsx)】
• Filter: "🌟 Qualified Leads"     • Left List: 💎 "Qualified Lead" Badge
• Emerald/Amber Status Badge      • Chat Header: Quick Requirement Card
• Modal shows full customer spec   • 1-Click "Take Control" Bot Toggle
• Button: "Open WhatsApp Chat"
```

### 1. In `Ceylon_gems.orders` Table:
When a lead is qualified, the backend inserts a specialized order record:
- `user_id`: Tenant owner UUID
- `customer_name`: Customer's name (from WhatsApp/chat)
- `customer_phone`: Customer's WhatsApp phone number
- `status`: `"qualified_lead"`
- `total_amount`: Numeric budget estimate (e.g. 15000) or 0
- `special_instructions`: Structured summary:
  ```
  [🌟 QUALIFIED LEAD — CEYLONA GEMS]
  Category: Silver Jewelry
  Item: Sapphire Solitaire Silver Ring
  Gemstone: Blue Sapphire (Classic Blue)
  Size: Ring Size 7
  Budget: LKR 10,000 - 20,000
  Recipient: Wife (Anniversary Gift)
  Needed By: 2026-10-15
  Packaging: Luxury Velvet Box & Card (Free/Paid)
  ```
- `order_items`: JSON array with the interested configured product(s).

### 2. In Orders Tab (`Orders.tsx`):
- Add `"qualified_lead"` to `statusOptions`:
  - Label: `🌟 Qualified Lead`
  - Badge style: `bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold`
- Add a dedicated quick filter tab or option: **"🌟 Qualified Leads"** so the sales team can view all hot leads with a single click.
- Order Details Modal displays the formatted Ceylona requirement sheet.
- Direct Action button: **"Open Chat"** (`navigate('/dashboard/conversations?phone=' + order.customer_phone)`).

### 3. In Conversations Tab (`Conversations.tsx`):
- **Thread List (Left sidebar):**
  - Check if the phone number has a `qualified_lead` record in `orders` (or metadata).
  - If qualified, display a prominent **`💎 Qualified Lead`** badge right below the customer's name.
- **Chat Window (Right panel):**
  - Render a persistent, elegant **"Lead Requirement Summary Bar"** at the top of the chat:
    ```
    💎 Qualified Lead | Budget: LKR 10k-20k | Blue Sapphire Ring (Size 7) | For Wife | Due: Oct 15
    [Take Control Button]
    ```
  - The sales agent instantly sees the exact context without having to read through previous chat history.

---

## 5. Technical Architecture & Component Breakdown

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BUILDSTART BACKEND                              │
│                                                                        │
│  ┌──────────────────────┐        ┌──────────────────────────────────┐  │
│  │   PostgreSQL DB      │        │      Deno Edge Functions         │  │
│  │  Schema: Ceylon_gems │        │                                  │  │
│  │                      │        │  1. webhook-wsender-Ceylon_gems  │  │
│  │  • orders            │◄───────┤  2. process-message-Ceylon_gems  │  │
│  │    └ qualified_lead  │        │  3. ai-chat-Ceylon_gems          │  │
│  │  • products (20)     │        │  4. send-whatsapp-Ceylon_gems    │  │
│  │  • chat_takeovers    │        │  5. send-followups-Ceylon_gems   │  │
│  │  • settings          │        └──────────────────────────────────┘  │
│  └──────────────────────┘                         ▲                    │
└───────────────────────────────────────────────────┼────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴────────────────────┐
                 │                                                       │
                 ▼                                                       ▼
      ┌─────────────────────┐                                 ┌─────────────────────┐
      │     WAHA Engine     │                                 │  Vite/React UI App  │
      │  (WhatsApp Gateway) │                                 │                     │
      │  • /api/sendText    │                                 │  • Orders.tsx       │
      │  • /api/sendVoice   │                                 │  • Conversations.tsx│
      │  • /api/sendImage   │                                 │  • Products.tsx     │
      └─────────────────────┘                                 └─────────────────────┘
```

---

### Component 1: Introductory WhatsApp Voice Note
- **How it works in existing system:**
  - `send-whatsapp-Ceylon_gems` already contains:
    ```typescript
    if (detectedType === "audio") {
      res = await wahaFetch("/api/sendVoice", { session: sessionName, chatId, file });
    }
    ```
    This delivers genuine PTT (push-to-talk) WhatsApp Voice Notes with microphone icons.
  - `process-message-Ceylon_gems` already supports `welcome_sequence` in `settings`:
    ```json
    {
      "welcome_sequence": [
        { "type": "text" },
        { "type": "media", "url": "https://media.buildstart.io/ceylon_gems/intro_voice_note.mp3" }
      ]
    }
    ```
- **Customization required:** Zero code changes. The client provides the audio recording, we upload it, and save the URL in `settings.welcome_message`.

---

### Component 2: Category-Aware AI Engine (`ai-chat-Ceylon_gems`)
- **System Prompt Architecture:**
  The system prompt will enforce the conversational rules:
  1. **Concise messaging:** Max 2–4 short sentences per message. Use clean emojis (`🔹`, `💍`, `💎`, `🎁`). No markdown asterisks (`*`).
  2. **One-question-at-a-time:** Never dump multiple questions in one message.
  3. **No upfront individual pricing:** Always respond with the broad spectrum (`LKR 4,400 to 1.5 Lakhs`) when asked for prices early.
  4. **3 Budget guidance tiers:** Present `LKR 4k-10k`, `LKR 10k-20k`, `Above 20k`.
  5. **Category-specific memory:** Track which category the customer selected and branch accordingly:
     - If *Gifting Gemstone*: Ask Type/Color ➔ Size Tier (1/2/3) ➔ Budget ➔ Recipient & Date ➔ Recommend 2–3 gems ➔ Ask about Gem Box.
     - If *Silver Jewelry*: Ask Ring vs Pendant ➔ Gemstone/Color ➔ Ring Size (if ring) ➔ Budget ➔ Recipient & Date ➔ Recommend 2–3 pieces ➔ Ask about Gift Box & Card.
     - If *Packaging*: Ask item type ➔ State exact price (differentiate free vs paid) ➔ Date.
  6. **Strict Boundary:** Do not recommend items outside the 20 products. If requested, collect requirement and output `<AGENT_HANDOFF_REQUIRED>`.
  7. **Structured Lead Tag:** When the customer shows interest in a recommended product, the AI appends a structured tag:
     ```xml
     <QUALIFIED_LEAD_JSON>
     {
       "category": "Silver Jewelry",
       "gemstone_type": "Blue Sapphire",
       "color": "Royal Blue",
       "size": "Ring Size 7",
       "budget": "LKR 10,000 - 20,000",
       "gift_recipient": "Wife (Anniversary)",
       "required_date": "2026-10-15",
       "interested_product": "Sapphire Solitaire Silver Ring",
       "packaging_requested": "Standard Velvet Box (Free)",
       "status": "qualified"
     }
     </QUALIFIED_LEAD_JSON>
     ```

---

### Component 3: Lead Extraction & Storage (`process-message-Ceylon_gems`)
- **Action upon receiving AI response:**
  1. Regex extracts `<QUALIFIED_LEAD_JSON>...</QUALIFIED_LEAD_JSON>`.
  2. Strips the tag so the customer never sees raw JSON.
  3. Inserts into `Ceylon_gems.orders`:
     - `status = 'qualified_lead'`
     - `customer_name = senderName`
     - `customer_phone = phoneNumber`
     - `order_items = [interestedProduct]`
     - `special_instructions = formattedSummary`
  4. Sends an instantaneous WhatsApp alert to the client's sales agent:
     ```
     💎 NEW QUALIFIED LEAD — Ceylona Gems
     👤 Customer: {customer_name} ({phone})
     🏷️ Category: {category}
     💎 Stone/Type: {gemstone_type} ({color}, {size})
     💰 Budget: {budget}
     🎁 Recipient: {gift_recipient}
     📅 Needed By: {required_date}
     🛒 Interested In: {interested_product}
     📦 Packaging: {packaging_requested}
     👉 View in Orders: https://app.buildstart.io/dashboard/orders
     ```

---

### Component 4: Human Agent Handoff (`chat_takeovers`)
- **How it works:**
  - The customer is told: *"I have noted down your exact requirements. Our jewelry specialist will contact you shortly with full details and options!"*
  - In `Conversations.tsx`, the sales agent clicks **"Take Control"**.
  - While `is_taken_over = true`, the AI stops processing inbound messages, giving 100% control to the human agent.
  - In `send-followups-Ceylon_gems`, taken-over conversations automatically suppress automated follow-up messages.

---

## 6. 20-Product Catalog Blueprint

Below is the planned distribution for the 20 configured products across the 3 categories:

| Item # | Category | Product Name | Variations (JSONB) | Base Price (LKR) | Images |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 1 | Gemstone (Std) | Natural Blue Sapphire | Size: Petite (0.7ct), Medium (1.5ct), Classic (2.5ct) | 35,000 | 2 images |
| 2 | Gemstone (Std) | Yellow Sapphire (Pusparaga) | Size: 1.0ct, 1.8ct, 2.5ct | 28,000 | 2 images |
| 3 | Gemstone (Std) | Pink Sapphire | Size: 0.8ct, 1.5ct, 2.2ct | 32,000 | 2 images |
| 4 | Gemstone (Std) | Natural Ceylon Ruby | Size: 0.8ct, 1.4ct, 2.0ct | 45,000 | 2 images |
| 5 | Gemstone (Std) | Star Sapphire | Size: 1.5ct, 2.5ct, 4.0ct | 38,000 | 2 images |
| 6 | Gemstone (Std) | Natural Amethyst | Size: 2.0ct, 3.5ct, 5.0ct | 8,500 | 2 images |
| 7 | Gemstone (Std) | Blue Topaz | Size: 2.0ct, 4.0ct, 6.0ct | 9,500 | 2 images |
| 8 | Gemstone (Std) | Natural Garnet | Size: 1.5ct, 2.5ct, 4.0ct | 7,500 | 2 images |
| 9 | Gemstone (Std) | Moonstone (Ceylon White) | Size: 2.0ct, 3.5ct, 5.0ct | 6,500 | 2 images |
| 10 | Gemstone (Std) | Peridot (Olive Green) | Size: 1.5ct, 2.5ct, 3.5ct | 9,000 | 2 images |
| 11 | Gemstone (Std) | Citrine (Golden Quartz) | Size: 2.0ct, 4.0ct, 6.0ct | 8,000 | 2 images |
| 12 | Gemstone (Std) | Green Tourmaline | Size: 1.2ct, 2.0ct, 3.0ct | 18,000 | 2 images |
| 13 | Gemstone (Prem)| Royal Blue Ceylon Sapphire | Size: 2.0ct, 3.5ct (Certified) | 120,000 | 3 images |
| 14 | Gemstone (Prem)| Padparadscha Sapphire | Size: 1.5ct, 2.5ct (Rare) | 180,000 | 3 images |
| 15 | Gemstone (Prem)| Star Ruby (Certified) | Size: 2.5ct, 4.0ct | 140,000 | 3 images |
| 16 | Silver Jewelry | Sapphire Solitaire Silver Ring | Ring Sizes: US 5, 6, 7, 8, 9, 10 | 22,500 | 3 images |
| 17 | Silver Jewelry | Vintage Silver Gemstone Pendant | Gemstone: Blue, Pink, Yellow | 18,500 | 3 images |
| 18 | Silver Jewelry | Halo Gemstone Silver Ring | Ring Sizes: US 5, 6, 7, 8, 9, 10 | 26,000 | 3 images |
| 19 | Gift Packaging | Luxury Wooden Gem Display Box | Option: Single Stone / Double Stone | 2,500 (Paid) | 2 images |
| 20 | Gift Packaging | Standard Velvet Box & Letter Card| Options: Box (Free), Card (+500 LKR) | 0 (Free/Paid) | 2 images |

---

## 7. Implementation Milestones

When approved, development proceeds in these modular phases:

1. **Phase 1: Seed Population for the 20 Products**
   - Populate `Ceylon_gems.products` with the 20 curated products, variations, prices, and image URLs.
2. **Phase 2: AI Prompt with Pricing Disclosure & Category Rules**
   - Implement the two-tier pricing disclosure (no upfront individual price; 4,400 to 1.5 Lakhs range).
   - Implement the 3 budget brackets (4k-10k, 10k-20k, >20k).
   - Implement category-specific branching and `<QUALIFIED_LEAD_JSON>` tag generation.
3. **Phase 3: Lead Extraction & Orders Tab Pipeline**
   - In `process-message-Ceylon_gems`, catch `<QUALIFIED_LEAD_JSON>` and insert into `Ceylon_gems.orders` as `status: 'qualified_lead'`.
   - Dispatch the WhatsApp alert to the sales agent.
4. **Phase 4: Orders & Conversations UI Enhancements (Starter Plan Support)**
   - In `Orders.tsx`, add the `🌟 Qualified Lead` status badge and filter option.
   - In `Conversations.tsx`, badge the chat thread with `💎 Qualified Lead` and render the top requirement summary bar.
5. **Phase 5: Voice Note & Welcome Sequence**
   - Upload the client's introduction voice note to storage and set in `settings.welcome_message`.
6. **Phase 6: End-to-End Verification**
   - Test each category flow on WhatsApp, verify pricing rules, verify qualification record in Orders, and test agent takeover.

---
*Document prepared for Ceylona Gems and Jewelry customization review.*
