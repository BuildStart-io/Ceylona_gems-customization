-- ============================================================================
-- 05_ceylon_gems_12_products_seed.sql
-- Seed script for Ceylona Gems & Jewelry (12 Master Products Catalog)
-- Includes Size variations (Small, Medium, Large, Custom Luxury Size)
-- All certificate & luxury details included in description
-- ============================================================================

DO $$
DECLARE
  uid uuid;
  user_cursor CURSOR FOR SELECT id FROM auth.users;
BEGIN
  FOR r IN user_cursor LOOP
    uid := r.id;

    -- Delete old products for clean insert of the 12 master products
    DELETE FROM "Ceylon_gems".products WHERE user_id = uid;

    -- 1. RED GARNET
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Red Garnet',
      '✨ A vibrant gemstone with a deep, elegant red glow looks like Ruby. Perfect for both daily wear and luxury jewellery.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 7,300+*' || E'\n' ||
      '*(For rare and extraordinary pieces ❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      4400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 4400},
            {"label": "Medium Size", "price": 5850},
            {"label": "Large Size", "price": 7300},
            {"label": "Custom Luxury Size (LKR 7,300+)", "price": 7300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 2. TOURMALINE
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Tourmaline',
      '🌈 A rainbow captured in stone, vivid and endlessly unique.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 10,450+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      10450.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Medium Size", "price": 10450},
            {"label": "Custom Luxury Size (LKR 10,450+)", "price": 10450}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 3. WHITE PEARL (From White and Rose Pearl Collection)
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'White Pearl',
      '🪷 Soft as moonlight, pure as the ocean’s whisper. Pure, delicate, and luminous. (White & Rose Pearl Collection)' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 9,300+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      5400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 5400},
            {"label": "Medium Size", "price": 7350},
            {"label": "Large Size", "price": 9300},
            {"label": "Custom Luxury Size (LKR 9,300+)", "price": 9300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 4. ROSE PEARL (From White and Rose Pearl Collection)
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Rose Pearl',
      '🪷 A blush of romance, delicate and luminous. Soft as moonlight, pure as the ocean’s whisper. (White & Rose Pearl Collection)' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 9,300+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      5400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 5400},
            {"label": "Medium Size", "price": 7350},
            {"label": "Large Size", "price": 9300},
            {"label": "Custom Luxury Size (LKR 9,300+)", "price": 9300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 5. BLUE SAPPHIRE
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Blue Sapphire',
      '💎 Special stone that won the hearts of millions and gave Sri Lanka a unique spot in the gem world.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 15,000+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      15000.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Medium Size", "price": 15000},
            {"label": "Custom Luxury Size (LKR 15,000+)", "price": 15000}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1600003014755-ba31aa59c4b6?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 6. EMERALD
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Emerald',
      '🍃 The lush green of nature’s heart, pure and regal.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 15,000+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      15000.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Medium Size", "price": 15000},
            {"label": "Custom Luxury Size (LKR 15,000+)", "price": 15000}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 7. AQUAMARINE
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Aquamarine',
      '🌊 The serene blue of ocean waves, calm and timeless.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 9,450+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      9450.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Medium Size", "price": 9450},
            {"label": "Custom Luxury Size (LKR 9,450+)", "price": 9450}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 8. OPAL
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Opal',
      '🫧 A kaleidoscope of colours, dancing with light in every glance.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 11,300+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      6400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 6400},
            {"label": "Medium Size", "price": 8850},
            {"label": "Large Size", "price": 11300},
            {"label": "Custom Luxury Size (LKR 11,300+)", "price": 11300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1598560917505-59a3ad559071?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 9. LONDON BLUE TOPAZ
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'London Blue Topaz',
      '🌊 A deep, sophisticated shade of blue with a bold and elegant brilliance darker than sky blue, yet glowing with luxury.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 7,300+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      6400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 6400},
            {"label": "Medium Size", "price": 8850},
            {"label": "Large Size", "price": 11300},
            {"label": "Custom Luxury Size (LKR 7,300+)", "price": 7300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 10. SWISS BLUE TOPAZ
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Swiss Blue Topaz',
      '💎 A bright, lively ocean-blue gemstone that shines with refreshing brilliance playful yet elegant, perfect for everyday luxury.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 7,300+*' || E'\n' ||
      '*(For those seeking something rare and extraordinary❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      6400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 6400},
            {"label": "Medium Size", "price": 8850},
            {"label": "Large Size", "price": 11300},
            {"label": "Custom Luxury Size (LKR 7,300+)", "price": 7300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 11. AMETHYST
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Amethyst',
      '🎆 A deep purple stone with royal elegance, sparkling with a velvety shine.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 7,300+*' || E'\n' ||
      '*(For rare and extraordinary pieces ❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      4400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 4400},
            {"label": "Medium Size", "price": 5850},
            {"label": "Large Size", "price": 7300},
            {"label": "Custom Luxury Size (LKR 7,300+)", "price": 7300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=800&q=80'],
      true
    );

    -- 12. CITRINE
    INSERT INTO "Ceylon_gems".products (
      user_id, name, description, price, product_type, delivery_price, variations, images, is_active
    ) VALUES (
      uid,
      'Citrine',
      '☀️ A golden-yellow gem with a bright, sunlit glow warm and naturally radiant.' || E'\n\n' ||
      '*🔴✨Custom Luxury Size – LKR 7,300+*' || E'\n' ||
      '*(For rare and extraordinary pieces ❇️)*' || E'\n\n' ||
      '✅ 1500 LKR worth Gem certificate Included in the above-mentioned price',
      4400.00,
      'physical',
      350.00,
      '[
        {
          "name": "Size",
          "options": [
            {"label": "Small Size", "price": 4400},
            {"label": "Medium Size", "price": 5850},
            {"label": "Large Size", "price": 7300},
            {"label": "Custom Luxury Size (LKR 7,300+)", "price": 7300}
          ]
        }
      ]'::jsonb,
      ARRAY['https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=800&q=80'],
      true
    );

  END LOOP;
END $$;
