-- ============================================================================
-- 06_ceylon_gems_faqs_seed.sql
-- Seed script for Ceylona Gems & Jewelry Sinhala & English FAQs (31 FAQs)
-- Also updates plan limits & profile tiers so no limits are hit
-- ============================================================================

-- 1. Upgrade plan limits and user tiers to Enterprise
UPDATE "Ceylon_gems".platform_settings
SET value = jsonb_set(
  jsonb_set(value, '{free,max_faqs}', '100'::jsonb),
  '{free,max_products}', '100'::jsonb
)
WHERE key = 'plan_limits';

UPDATE "Ceylon_gems".profiles
SET plan_tier = 'enterprise'
WHERE user_id IN (
  'c5547d20-25eb-4497-9379-72274c5ad71b'::uuid,
  '0994a4a7-359a-4a84-9ff5-7990ecd2b894'::uuid
);

-- 2. Seed the 31 FAQs for each active user
DO $$
DECLARE
  uid uuid;
  user_cursor CURSOR FOR SELECT id FROM auth.users;
BEGIN
  FOR r IN user_cursor LOOP
    uid := r.id;

    -- Clean existing FAQs for user
    DELETE FROM "Ceylon_gems".faqs WHERE user_id = uid;

    -- 1. Price
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '💎 Price එක කොච්චරද? / How much are the gemstones?',
      'අපි ළඟ gemstones Rs. 4,400 ඉඳන් Rs. 150,000 දක්වා තියෙනවා. Gemstone එක අනුව price එක වෙනස් වෙනවා.',
      true
    );

    -- 2. Certificate
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '📜 Certificate එක එනවද? / Do you provide gem certificates?',
      'ඔව්, අපි ළඟ තියෙන හැම gemstone එකක්ම government-registered private gem lab certificate එකක් එක්ක තමයි ලබා දෙන්නේ. Certificate එක gemstone price එකට included.',
      true
    );

    -- 3. COD
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🚚 COD තියෙනවද? / Is Cash on Delivery available?',
      'මේ වෙලාවේ COD temporarily pause කරලා තියෙන්නේ, අපේ courier service එකෙන් ලැබුණු poor service එක නිසා. අපි අපේ customers ලට හොඳ service එකක් සහ quality එකක් ලබාදීම ගොඩක් වැදගත් කරන නිසා තමයි මේ තීරණය ගත්තේ. ❤️' || E'\n\n' || 'වැඩි විස්තර දැනගන්න ඕනේ නම්, අපේ agent කෙනෙක් ඔයාට assist කරයි.',
      true
    );

    -- 4. Genuine gems
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '💎 මේ ඇත්තටම genuine gems ද? / Are these genuine natural gemstones?',
      'ඔව්, අපි ළඟ තියෙන සියලුම gemstones real & genuine gemstones. ඒ වගේම හැම gemstone එකක්ම gem lab certificate එකක් එක්ක ලබා දෙනවා.',
      true
    );

    -- 5. Preparation time
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '⏳ කොච්චර දවස් යනවද? / How long does it take to prepare an order?',
      'සාමාන්යයෙන් gemstone order එකක් prepare කරලා ready කරන්න සති 2–3ක් වගේ යනවා. ඉක්මනට අවශ්ය නම් අපේ agent ගෙන් request කරන්න පුළුවන්.',
      true
    );

    -- 6. Location
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '📍 ඔයාලා කොහෙද? / Where are you located?',
      'අපි Wellampitiya වල based වෙලා ඉන්නේ.',
      true
    );

    -- 7. Physical branch / visit
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🏪 ඇවිල්ලා බලලා ගන්න පුළුවන්ද? / Can we visit your store?',
      'සමාවෙන්න, දැනට අපි operate කරන්නේ online විතරයි. අපේ පළමු branch එක open කරන්න වැඩ කටයුතු දැන් සිදු කරගෙන යනවා. ✨',
      true
    );

    -- 8. Pickup
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '📦 Pickup පුළුවන්ද? / Can I pickup the order?',
      'ඔව්, order එක ready වුණාට පස්සේ අපේ location එකෙන් pickup කරන්න පුළුවන්.',
      true
    );

    -- 9. January birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 January stone / January birthstone',
      'January birthstone එක Garnet.',
      true
    );

    -- 10. February birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 February stone / February birthstone',
      'February birthstone එක Amethyst.',
      true
    );

    -- 11. March birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 March stone / March birthstone',
      'March birthstone එක Aquamarine.',
      true
    );

    -- 12. April birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 April stone / April birthstone',
      'April birthstone එක Diamond.',
      true
    );

    -- 13. May birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 May stone / May birthstone',
      'May birthstone එක Emerald.',
      true
    );

    -- 14. June birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 June stone / June birthstone',
      'June birthstone එක Pearl / Alexandrite / Moonstone.',
      true
    );

    -- 15. July birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 July stone / July birthstone',
      'July birthstone එක Ruby.',
      true
    );

    -- 16. September birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 September stone / September birthstone',
      'September birthstone එක Sapphire.',
      true
    );

    -- 17. October birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 October stone / October birthstone',
      'October birthstone එක Opal / Tourmaline.',
      true
    );

    -- 18. November birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 November stone / November birthstone',
      'November birthstone එක Topaz / Citrine.',
      true
    );

    -- 19. December birthstone
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎂 December stone / December birthstone',
      'December birthstone එක Tanzanite / Turquoise / Blue Topaz.',
      true
    );

    -- 20. Jewellery crafting
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '💍 Jewellery හදනවද? / Do you make jewellery?',
      'ඔව්, අපි 925 silver jewellery high-grade craftsmanship එකකින් handcraft කරනවා.',
      true
    );

    -- 21. Pendant crafting
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '📿 Pendant හදනවද? / Do you make pendants?',
      'ඔව්, අපි 925 silver pendants high-grade craftsmanship එකකින් හදනවා.',
      true
    );

    -- 22. Ring crafting
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '💍 Ring හදනවද? / Do you make rings?',
      'ඔව්, අපි 925 silver rings high-grade craftsmanship එකකින් හදනවා.',
      true
    );

    -- 23. Custom jewellery timeline
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🎨 Custom order එකක් හදන්න කොච්චර කල් යනවද? / Custom order duration',
      'Jewellery order එකක් අපේ quality සහ standard එකට හරියටම හදන්න සති 3–4ක් වගේ කාලයක් යනවා.',
      true
    );

    -- 24. Delivery availability
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🚚 Delivery available ද? / Do you offer delivery?',
      'ඔව්, අපි island-wide delivery offer කරනවා. දැනට 500+ orders safely deliver කරලා තියෙනවා. ❤️',
      true
    );

    -- 25. Gift personal message
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '💌 Gift එකට personal message එකක් add කරන්න පුළුවන්ද? / Can I add a personal gift message?',
      'ඔව්, ඔයාට කැමති විදිහට අපේ designer එක්ක custom design එකක් create කරලා, ඔයා වෙනුවෙන් special design එකක් හදන්න පුළුවන්. මේ සඳහා Rs. 950 charge එකක් තියෙනවා.',
      true
    );

    -- 26. Price increase / value
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '📈 මේ gemstones වල price එක වැඩි වෙනවද? / Do gemstone prices increase?',
      'ඔව්, demand සහ supply එක අනුව gemstone වල price එක වැඩි වෙන්න පුළුවන්.',
      true
    );

    -- 27. Gold plating
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '✨ Gold plating තියෙනවද? / Is gold plating available?',
      'ඔව්, silver jewellery වලට gold plating කරන්න පුළුවන්.',
      true
    );

    -- 28. White gold plating
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🤍 White gold plating තියෙනවද? / Is white gold plating available?',
      'ඔව්, silver jewellery වලට white gold plating කරන්න පුළුවන්.',
      true
    );

    -- 29. Silver jewellery purity
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🥈 Jewellery එක silver ද? / Is your jewellery real silver?',
      'ඔව්, අපි 925 silver jewellery උසස් තත්ත්වයකින් handcraft කරනවා.',
      true
    );

    -- 30. Gold jewellery
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '🟡 Gold jewellery හදනවද? / Do you make solid gold jewellery?',
      'දැනට gold orders temporarily pause කරලා තියෙනවා. විශේෂ request එකක් තියෙනවා නම් අපේ agent කෙනෙක් සමඟ contact වෙන්න.',
      true
    );

    -- 31. Jewellery sizing assistance
    INSERT INTO "Ceylon_gems".faqs (user_id, question, answer, is_active)
    VALUES (
      uid,
      '📏 Jewellery size එක කොහොමද ගන්නේ? / How do I measure my jewellery size?',
      'Jewellery size එක ගන්න ක්‍රම කිහිපයක් තියෙනවා. අපේ agent කෙනෙක් ඔයාට සුදුසු ක්‍රමයට size එක ගන්න assist කරයි.',
      true
    );

  END LOOP;
END $$;
