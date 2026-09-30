-- ============================================================================
-- 04_ceylon_gems_catalog_seed.sql
-- Seed script for Ceylona Gems & Jewelry (Exact 20 Products Catalog)
-- Categories:
--   1. Gifting Gemstones (8 items)
--   2. Gemstone-Based Solid 925 Silver Jewelry (8 items)
--   3. Gift Packaging & Add-ons (4 items)
-- ============================================================================

-- Function to seed the 20 Ceylona Gems catalog products for a specific user
CREATE OR REPLACE FUNCTION "Ceylon_gems".seed_ceylon_gems_catalog(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- --------------------------------------------------------------------------
  -- CATEGORY 1: Gifting Gemstones (8 items)
  -- --------------------------------------------------------------------------

  INSERT INTO "Ceylon_gems".products (
    user_id, name, description, price, product_type, delivery_price, variations, images, is_active
  ) VALUES
  (
    target_user_id,
    'Standard Oval Ceylon Blue Sapphire',
    'Natural authentic Ceylon Blue Sapphire gemstone. Cut into a brilliant oval facet. Ideal for gifting or setting into custom rings and pendants.',
    6500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "5x3 mm (approx 0.45ct)", "price": 6500},
          {"label": "6x4 mm (approx 0.75ct)", "price": 8500},
          {"label": "7x5 mm (approx 1.20ct)", "price": 12500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Premium Royal Blue Ceylon Sapphire',
    'Heirloom quality Sri Lankan Royal Blue Sapphire with exceptional saturation and crystal clarity. A prestigious gift choice.',
    18500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "6x4 mm (approx 0.85ct)", "price": 18500},
          {"label": "7x5 mm (approx 1.40ct)", "price": 28000},
          {"label": "8x6 mm (approx 2.10ct)", "price": 45000}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Pastel Pink Ceylon Sapphire',
    'Delicate pastel baby pink Ceylon natural sapphire, brilliant round or oval cut. Perfect romantic keepsake or promise gemstone.',
    8000.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "5x3 mm (approx 0.45ct)", "price": 8000},
          {"label": "6x4 mm (approx 0.80ct)", "price": 11500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Vivid Magenta Pink Ceylon Sapphire',
    'Intense, rich hot pink/magenta natural Ceylon sapphire with lively fire. Highly sought-after for luxury engagement and milestone gifts.',
    22000.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "6x4 mm (approx 0.85ct)", "price": 22000},
          {"label": "7x5 mm (approx 1.35ct)", "price": 34000}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Golden Yellow Ceylon Sapphire (Pushparaga)',
    'Traditional Sri Lankan natural Yellow Sapphire (Pushparaga), auspicious for prosperity and success. Radiant cushion / oval cut.',
    7500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "5x4 mm (approx 0.55ct)", "price": 7500},
          {"label": "6x5 mm (approx 0.95ct)", "price": 11000},
          {"label": "7x6 mm (approx 1.50ct)", "price": 18500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Pigeon Blood Red Ceylon Ruby',
    'Exquisite unheated/gently treated Sri Lankan natural ruby with deep scarlet fire. Certified gemstone perfect for anniversary gifts.',
    25000.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "5x4 mm (approx 0.60ct)", "price": 25000},
          {"label": "6x4 mm (approx 0.90ct)", "price": 38000}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Natural Ceylon Tsavorite Green Garnet',
    'Vibrant grass-green natural Tsavorite garnet mined in Ceylon. Outstanding brilliance surpassing emeralds without oil treatment.',
    9500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "5 mm Round (approx 0.60ct)", "price": 9500},
          {"label": "6 mm Round (approx 1.10ct)", "price": 16000}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Royal Purple Ceylon Amethyst',
    'Deep velvety violet Ceylon natural amethyst cut with brilliant Portuguese facet. An accessible and beloved gifting gemstone.',
    4400.00,
    'physical',
    350.00,
    '[
      {
        "name": "Gemstone Dimensions / Weight",
        "options": [
          {"label": "6 mm Round (approx 0.90ct)", "price": 4400},
          {"label": "8 mm Round (approx 2.00ct)", "price": 6200}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'],
    true
  ),

  -- --------------------------------------------------------------------------
  -- CATEGORY 2: Gemstone-Based Solid 925 Silver Jewelry (8 items)
  -- --------------------------------------------------------------------------

  (
    target_user_id,
    'Solid 925 Silver Classic Solitaire Sapphire Ring',
    'Handcrafted in solid 925 sterling silver with rhodium anti-tarnish finish. Features a vibrant 6x4mm Ceylon blue sapphire in 4-prong setting.',
    12500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Ring Size (US)",
        "options": [
          {"label": "US 5 (Small)", "price": 12500},
          {"label": "US 6 (Standard)", "price": 12500},
          {"label": "US 7 (Standard)", "price": 12500},
          {"label": "US 8 (Medium)", "price": 12500},
          {"label": "US 9 (Large)", "price": 12500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Halo Diamond-Cut Sapphire Ring',
    'Regal solid sterling silver ring with a centerpiece Ceylon blue sapphire surrounded by a sparkling halo of zircon accents.',
    16500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Ring Size (US)",
        "options": [
          {"label": "US 6", "price": 16500},
          {"label": "US 7", "price": 16500},
          {"label": "US 8", "price": 16500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Pink Sapphire Promise Ring',
    'Dainty romantic band in 925 sterling silver set with an authentic pastel pink Ceylon sapphire. Elegant everyday luxury.',
    14000.00,
    'physical',
    350.00,
    '[
      {
        "name": "Ring Size (US)",
        "options": [
          {"label": "US 5", "price": 14000},
          {"label": "US 6", "price": 14000},
          {"label": "US 7", "price": 14000}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1598560917505-59a3ad559071?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Modern Bezel Blue Sapphire Ring',
    'Contemporary protective bezel setting in 925 silver holding a faceted Ceylon blue sapphire. Sleek, snag-free everyday wear.',
    13500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Ring Size (US)",
        "options": [
          {"label": "US 6", "price": 13500},
          {"label": "US 7", "price": 13500},
          {"label": "US 8", "price": 13500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Classic Teardrop Sapphire Pendant',
    'Timeless pear/teardrop Ceylon blue sapphire suspended from a solid 925 sterling silver bail. Includes matching 18-inch silver chain.',
    9500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Silver Chain Length",
        "options": [
          {"label": "16 inch (Choker length)", "price": 9500},
          {"label": "18 inch (Standard princess)", "price": 9500},
          {"label": "20 inch (Comfort length)", "price": 10500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Solitaire Cushion Sapphire Pendant',
    'Regal cushion-cut Ceylon blue sapphire set in minimalist 4-prong 925 silver setting. Comes with fine Italian link 925 chain.',
    11000.00,
    'physical',
    350.00,
    '[
      {
        "name": "Silver Chain Length",
        "options": [
          {"label": "18 inch (Standard)", "price": 11000},
          {"label": "20 inch (Long)", "price": 12000}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Lotus Floral Ruby Pendant',
    'Artisan designed lotus blossom in polished 925 silver featuring a sparkling natural Ceylon ruby at its center. Includes 18-inch chain.',
    15500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Silver Chain Length",
        "options": [
          {"label": "18 inch (Standard)", "price": 15500},
          {"label": "20 inch (Long)", "price": 16500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Solid 925 Silver Oval Tsavorite Green Pendant',
    'Lush Ceylon green Tsavorite garnet in a shimmering micro-pave halo setting of solid 925 sterling silver. Includes 18-inch chain.',
    14500.00,
    'physical',
    350.00,
    '[
      {
        "name": "Silver Chain Length",
        "options": [
          {"label": "18 inch (Standard)", "price": 14500},
          {"label": "20 inch (Long)", "price": 15500}
        ]
      }
    ]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'],
    true
  ),

  -- --------------------------------------------------------------------------
  -- CATEGORY 3: Gift Packaging & Add-ons (4 items)
  -- --------------------------------------------------------------------------

  (
    target_user_id,
    'Luxury Royal Blue Velvet Ring & Gem Presentation Box',
    'Plush deep royal blue velvet jewelry box with embossed gold Ceylona foil logo and satin inner lining. Suitable for rings, pendants, or loose gems.',
    1200.00,
    'physical',
    200.00,
    '[]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Handcrafted Polished Mahogany Keepsake Box',
    'Exotic Sri Lankan solid mahogany wooden presentation box with high-gloss lacquer finish and brass hinges. An enduring gift heirloom.',
    2500.00,
    'physical',
    250.00,
    '[]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Calligraphy Handwritten Gift Card & Wax Seal',
    'Thick cotton deckle-edge card custom written with your personalized gift message in gold calligraphy ink, sealed with a bespoke wax stamp.',
    650.00,
    'physical',
    0.00,
    '[]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=800&q=80'],
    true
  ),
  (
    target_user_id,
    'Complete Luxury Celebration Gift Hamper Packaging',
    'The full VIP gifting presentation: Velvet presentation box, gift bag with silk ribbon, custom handwritten card, and gem authenticity certificate envelope.',
    3800.00,
    'physical',
    350.00,
    '[]'::jsonb,
    ARRAY['https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'],
    true
  );

  -- Also seed default welcome sequence and auto response settings for Ceylona Gems
  INSERT INTO "Ceylon_gems".settings (user_id, key, value)
  VALUES (
    target_user_id,
    'welcome_message',
    '{
      "text": "Ayubowan! Welcome to Ceylona Gems & Jewelry. 💎\nWe specialize in certified natural Ceylon gemstones and solid 925 sterling silver jewelry, crafted for meaningful gifting.\n\nHow may we assist you today?",
      "bypass_triggers": ["hi", "hello", "price", "catalog", "gem"]
    }'::jsonb
  )
  ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;

  RAISE NOTICE 'Seeded 20 Ceylona Gems catalog products for user %', target_user_id;
END;
$$;
