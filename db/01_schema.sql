--
-- PostgreSQL database dump
--

\restrict GCoNOs7mBfXioTfTnsPcdgMmKCwWOcfA0SlfN3WrM1XpO6Nhmj9aKeXA6JwDskO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Ceylon_gems; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "Ceylon_gems";


--
-- Name: SCHEMA "Ceylon_gems"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "Ceylon_gems" IS 'Ceylon_gems tenant schema';


--
-- Name: app_role; Type: TYPE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TYPE "Ceylon_gems".app_role AS ENUM (
    'super_admin',
    'business_user'
);


--
-- Name: plan_tier; Type: TYPE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TYPE "Ceylon_gems".plan_tier AS ENUM (
    'free',
    'pro',
    'enterprise'
);


--
-- Name: can_read_usage(uuid); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".can_read_usage(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
  SELECT auth.uid() IS NULL
      OR auth.uid() = _user_id
      OR "Ceylon_gems".has_role(auth.uid(), 'super_admin'::app_role)
      OR "Ceylon_gems".is_staff_of(auth.uid(), _user_id)
$$;


--
-- Name: enforce_order_limit(); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".enforce_order_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
DECLARE
  current_count INT;
  max_allowed INT;
  tier TEXT;
  addon INT;
  plan_max INT;
  platform_limits JSONB;
  billing_start TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  next_date TIMESTAMPTZ;
  user_paused BOOLEAN;
BEGIN
  SELECT p.plan_tier, p.addon_orders, p.billing_cycle_start, p.is_paused
  INTO tier, addon, billing_start, user_paused
  FROM profiles p WHERE p.user_id = NEW.user_id;

  IF user_paused = true THEN
    RAISE EXCEPTION 'Account is paused. Cannot create orders.';
  END IF;

  IF tier IS NULL THEN
    tier := 'free';
    addon := 0;
  END IF;

  -- Calculate billing month start
  IF billing_start IS NOT NULL THEN
    month_start := billing_start;
    LOOP
      next_date := month_start + INTERVAL '1 month';
      EXIT WHEN next_date > NOW();
      month_start := next_date;
    END LOOP;
  ELSE
    month_start := date_trunc('month', NOW());
  END IF;

  SELECT ps.value INTO platform_limits
  FROM platform_settings ps WHERE ps.key = 'plan_limits';

  IF platform_limits IS NOT NULL AND platform_limits->tier IS NOT NULL THEN
    plan_max := COALESCE((platform_limits->tier->>'max_orders_per_month')::INT, 50);
  ELSE
    plan_max := CASE tier WHEN 'pro' THEN 500 WHEN 'enterprise' THEN 9999 ELSE 50 END;
  END IF;

  max_allowed := plan_max + COALESCE(addon, 0);

  SELECT COUNT(*) INTO current_count
  FROM orders WHERE user_id = NEW.user_id AND created_at >= month_start;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Monthly order limit reached (% of %). Upgrade your plan to process more orders.', current_count, max_allowed;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: get_ai_message_usage(uuid, timestamp with time zone); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".get_ai_message_usage(_user_id uuid, _since timestamp with time zone) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
DECLARE c integer;
BEGIN
  IF NOT "Ceylon_gems".can_read_usage(_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT COUNT(*) INTO c
  FROM "Ceylon_gems".ai_usage_logs
  WHERE user_id = _user_id AND created_at >= _since;
  RETURN COALESCE(c, 0);
END;
$$;


--
-- Name: get_contact_usage(uuid, timestamp with time zone); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".get_contact_usage(_user_id uuid, _since timestamp with time zone) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
DECLARE c integer;
BEGIN
  IF NOT "Ceylon_gems".can_read_usage(_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT COUNT(DISTINCT phone_number) INTO c
  FROM "Ceylon_gems".contact_usage
  WHERE user_id = _user_id AND created_at >= _since;
  RETURN COALESCE(c, 0);
END;
$$;


--
-- Name: get_staff_owner_id(uuid); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".get_staff_owner_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
  SELECT owner_id FROM "Ceylon_gems".staff_accounts
  WHERE staff_user_id = _user_id AND is_active = true
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
BEGIN
  INSERT INTO "Ceylon_gems".profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user_role(); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".handle_new_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
BEGIN
  INSERT INTO "Ceylon_gems".user_roles (user_id, role)
  VALUES (NEW.id, 'business_user');
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user_settings(); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".handle_new_user_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
BEGIN
  INSERT INTO "Ceylon_gems".settings (user_id, key, value) VALUES
    (NEW.id, 'welcome_message', '{"text": "Welcome! How can I help you today?"}'::jsonb),
    (NEW.id, 'payment_info', '{"bank_name": "", "account_number": "", "account_name": ""}'::jsonb),
    (NEW.id, 'auto_responses', '{"enabled": true}'::jsonb);
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, "Ceylon_gems".app_role); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".has_role(_user_id uuid, _role "Ceylon_gems".app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Ceylon_gems".user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "Ceylon_gems".profiles
    WHERE user_id = auth.uid()
  );
END;
$$;


--
-- Name: is_staff_of(uuid, uuid); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".is_staff_of(_staff_user_id uuid, _owner_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO "Ceylon_gems", public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Ceylon_gems".staff_accounts
    WHERE staff_user_id = _staff_user_id
      AND owner_id = _owner_id
      AND is_active = true
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: "Ceylon_gems"; Owner: -
--

CREATE FUNCTION "Ceylon_gems".update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO "Ceylon_gems", public
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_usage_logs; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".ai_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_takeovers; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".chat_takeovers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_number text NOT NULL,
    is_taken_over boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_usage; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".contact_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_number text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    message text NOT NULL,
    direction text NOT NULL,
    message_type text DEFAULT 'text'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT conversations_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: faq_usage_logs; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".faq_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    faq_id uuid NOT NULL,
    user_id uuid NOT NULL,
    phone_number text NOT NULL,
    sender_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faqs; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    product_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    is_tracked boolean DEFAULT false NOT NULL,
    media_urls text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: fcm_tokens; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".fcm_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_token text NOT NULL,
    device_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leads; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_number text NOT NULL,
    customer_name text,
    assigned_to uuid,
    status text DEFAULT 'new'::text NOT NULL,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: message_queue; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".message_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wsender_message_id text NOT NULL,
    user_id uuid NOT NULL,
    phone_number text NOT NULL,
    sender_name text DEFAULT 'Unknown'::text,
    message_text text DEFAULT ''::text,
    message_type text DEFAULT 'text'::text,
    session_api_key text,
    raw_payload jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    correlation_id text
);


--
-- Name: orders; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_address text,
    order_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    special_instructions text,
    payment_method text DEFAULT 'cod'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    whatsapp_phone text,
    district text,
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cod'::text, 'bank_transfer'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'qualified_lead'::text])))
);


--
-- Name: platform_settings; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".platform_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    product_type text DEFAULT 'physical'::text NOT NULL,
    variations jsonb DEFAULT '[]'::jsonb,
    images text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    delivery_price numeric DEFAULT 0,
    video_url text,
    CONSTRAINT products_product_type_check CHECK ((product_type = ANY (ARRAY['physical'::text, 'digital'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_tier "Ceylon_gems".plan_tier DEFAULT 'free'::"Ceylon_gems".plan_tier NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    business_name text,
    max_products integer DEFAULT 5,
    max_faqs integer DEFAULT 10,
    billing_cycle_start timestamp with time zone DEFAULT now(),
    is_paused boolean DEFAULT false NOT NULL,
    addon_products integer DEFAULT 0 NOT NULL,
    addon_faqs integer DEFAULT 0 NOT NULL,
    addon_orders integer DEFAULT 0 NOT NULL,
    addon_ai_messages integer DEFAULT 0 NOT NULL,
    addon_images integer DEFAULT 0 NOT NULL,
    addon_staff integer DEFAULT 0 NOT NULL,
    addon_contacts integer DEFAULT 0 NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: staff_accounts; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".staff_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    staff_user_id uuid NOT NULL,
    staff_email text NOT NULL,
    staff_name text,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp_number text
);


--
-- Name: user_roles; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role "Ceylon_gems".app_role DEFAULT 'business_user'::"Ceylon_gems".app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_wsender_sessions; Type: TABLE; Schema: "Ceylon_gems"; Owner: -
--

CREATE TABLE "Ceylon_gems".user_wsender_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id text NOT NULL,
    session_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_api_key text
);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_takeovers chat_takeovers_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".chat_takeovers
    ADD CONSTRAINT chat_takeovers_pkey PRIMARY KEY (id);


--
-- Name: chat_takeovers chat_takeovers_user_id_phone_number_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".chat_takeovers
    ADD CONSTRAINT chat_takeovers_user_id_phone_number_key UNIQUE (user_id, phone_number);


--
-- Name: contact_usage contact_usage_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".contact_usage
    ADD CONSTRAINT contact_usage_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: faq_usage_logs faq_usage_logs_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".faq_usage_logs
    ADD CONSTRAINT faq_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_user_id_device_token_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_device_token_key UNIQUE (user_id, device_token);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leads leads_user_id_phone_number_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".leads
    ADD CONSTRAINT leads_user_id_phone_number_key UNIQUE (user_id, phone_number);


--
-- Name: message_queue message_queue_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".message_queue
    ADD CONSTRAINT message_queue_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_key_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".platform_settings
    ADD CONSTRAINT platform_settings_key_key UNIQUE (key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: settings settings_user_id_key_unique; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".settings
    ADD CONSTRAINT settings_user_id_key_unique UNIQUE (user_id, key);


--
-- Name: staff_accounts staff_accounts_owner_id_staff_user_id_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".staff_accounts
    ADD CONSTRAINT staff_accounts_owner_id_staff_user_id_key UNIQUE (owner_id, staff_user_id);


--
-- Name: staff_accounts staff_accounts_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".staff_accounts
    ADD CONSTRAINT staff_accounts_pkey PRIMARY KEY (id);


--
-- Name: message_queue unique_wsender_message; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".message_queue
    ADD CONSTRAINT unique_wsender_message UNIQUE (wsender_message_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_wsender_sessions user_wsender_sessions_pkey; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".user_wsender_sessions
    ADD CONSTRAINT user_wsender_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_wsender_sessions user_wsender_sessions_user_id_session_id_key; Type: CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".user_wsender_sessions
    ADD CONSTRAINT user_wsender_sessions_user_id_session_id_key UNIQUE (user_id, session_id);


--
-- Name: contact_usage_unique_per_cycle; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE UNIQUE INDEX contact_usage_unique_per_cycle ON "Ceylon_gems".contact_usage USING btree (user_id, phone_number, period_start);


--
-- Name: idx_ai_usage_logs_user_created; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_ai_usage_logs_user_created ON "Ceylon_gems".ai_usage_logs USING btree (user_id, created_at);


--
-- Name: idx_contact_usage_user_created; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_contact_usage_user_created ON "Ceylon_gems".contact_usage USING btree (user_id, created_at);


--
-- Name: idx_conversations_created_at; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_conversations_created_at ON "Ceylon_gems".conversations USING btree (created_at DESC);


--
-- Name: idx_conversations_phone; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_conversations_phone ON "Ceylon_gems".conversations USING btree (phone_number);


--
-- Name: idx_faq_usage_logs_faq_id; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_faq_usage_logs_faq_id ON "Ceylon_gems".faq_usage_logs USING btree (faq_id);


--
-- Name: idx_faq_usage_logs_user_phone; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_faq_usage_logs_user_phone ON "Ceylon_gems".faq_usage_logs USING btree (user_id, phone_number);


--
-- Name: idx_leads_assigned; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_leads_assigned ON "Ceylon_gems".leads USING btree (assigned_to);


--
-- Name: idx_leads_user; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_leads_user ON "Ceylon_gems".leads USING btree (user_id);


--
-- Name: idx_message_queue_processed; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_message_queue_processed ON "Ceylon_gems".message_queue USING btree (processed_at) WHERE (status = 'done'::text);


--
-- Name: idx_message_queue_status; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_message_queue_status ON "Ceylon_gems".message_queue USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: idx_message_queue_status_created; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_message_queue_status_created ON "Ceylon_gems".message_queue USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: idx_message_queue_user_processing; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_message_queue_user_processing ON "Ceylon_gems".message_queue USING btree (user_id) WHERE (status = 'processing'::text);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_orders_created_at ON "Ceylon_gems".orders USING btree (created_at DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: "Ceylon_gems"; Owner: -
--

CREATE INDEX idx_orders_status ON "Ceylon_gems".orders USING btree (status);


--
-- Name: orders check_order_limit; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER check_order_limit BEFORE INSERT ON "Ceylon_gems".orders FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".enforce_order_limit();


--
-- Name: faqs update_faqs_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON "Ceylon_gems".faqs FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: fcm_tokens update_fcm_tokens_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_fcm_tokens_updated_at BEFORE UPDATE ON "Ceylon_gems".fcm_tokens FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON "Ceylon_gems".leads FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: message_queue update_message_queue_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_message_queue_updated_at BEFORE UPDATE ON "Ceylon_gems".message_queue FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON "Ceylon_gems".orders FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: platform_settings update_platform_settings_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON "Ceylon_gems".platform_settings FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON "Ceylon_gems".products FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON "Ceylon_gems".profiles FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: settings update_settings_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON "Ceylon_gems".settings FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: staff_accounts update_staff_accounts_updated_at; Type: TRIGGER; Schema: "Ceylon_gems"; Owner: -
--

CREATE TRIGGER update_staff_accounts_updated_at BEFORE UPDATE ON "Ceylon_gems".staff_accounts FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".update_updated_at_column();


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: faq_usage_logs faq_usage_logs_faq_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".faq_usage_logs
    ADD CONSTRAINT faq_usage_logs_faq_id_fkey FOREIGN KEY (faq_id) REFERENCES "Ceylon_gems".faqs(id) ON DELETE CASCADE;


--
-- Name: faqs faqs_product_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".faqs
    ADD CONSTRAINT faqs_product_id_fkey FOREIGN KEY (product_id) REFERENCES "Ceylon_gems".products(id) ON DELETE SET NULL;


--
-- Name: faqs faqs_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".faqs
    ADD CONSTRAINT faqs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: settings settings_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".settings
    ADD CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: staff_accounts staff_accounts_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".staff_accounts
    ADD CONSTRAINT staff_accounts_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_wsender_sessions user_wsender_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE ONLY "Ceylon_gems".user_wsender_sessions
    ADD CONSTRAINT user_wsender_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: platform_settings Authenticated users can view platform settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Authenticated users can view platform settings" ON "Ceylon_gems".platform_settings FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: staff_accounts Owners can create staff; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Owners can create staff" ON "Ceylon_gems".staff_accounts FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: staff_accounts Owners can delete their staff; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Owners can delete their staff" ON "Ceylon_gems".staff_accounts FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: staff_accounts Owners can update their staff; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Owners can update their staff" ON "Ceylon_gems".staff_accounts FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: staff_accounts Owners can view their staff; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Owners can view their staff" ON "Ceylon_gems".staff_accounts FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: leads Owners manage their leads; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Owners manage their leads" ON "Ceylon_gems".leads TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Service can insert profiles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Service can insert profiles" ON "Ceylon_gems".profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: conversations Staff can create owner conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can create owner conversations" ON "Ceylon_gems".conversations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = conversations.user_id) AND (sa.is_active = true) AND ('conversations'::text = ANY (sa.permissions))))));


--
-- Name: faqs Staff can create owner faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can create owner faqs" ON "Ceylon_gems".faqs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = faqs.user_id) AND (sa.is_active = true) AND ('faqs'::text = ANY (sa.permissions))))));


--
-- Name: products Staff can create owner products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can create owner products" ON "Ceylon_gems".products FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = products.user_id) AND (sa.is_active = true) AND ('products'::text = ANY (sa.permissions))))));


--
-- Name: chat_takeovers Staff can manage owner takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can manage owner takeovers" ON "Ceylon_gems".chat_takeovers FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = chat_takeovers.user_id) AND (sa.is_active = true) AND ('conversations'::text = ANY (sa.permissions))))));


--
-- Name: faqs Staff can update owner faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can update owner faqs" ON "Ceylon_gems".faqs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = faqs.user_id) AND (sa.is_active = true) AND ('faqs'::text = ANY (sa.permissions))))));


--
-- Name: orders Staff can update owner orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can update owner orders" ON "Ceylon_gems".orders FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = orders.user_id) AND (sa.is_active = true) AND ('orders'::text = ANY (sa.permissions))))));


--
-- Name: products Staff can update owner products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can update owner products" ON "Ceylon_gems".products FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = products.user_id) AND (sa.is_active = true) AND ('products'::text = ANY (sa.permissions))))));


--
-- Name: chat_takeovers Staff can update owner takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can update owner takeovers" ON "Ceylon_gems".chat_takeovers FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = chat_takeovers.user_id) AND (sa.is_active = true) AND ('conversations'::text = ANY (sa.permissions))))));


--
-- Name: staff_accounts Staff can view own record; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view own record" ON "Ceylon_gems".staff_accounts FOR SELECT USING ((auth.uid() = staff_user_id));


--
-- Name: conversations Staff can view owner conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner conversations" ON "Ceylon_gems".conversations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = conversations.user_id) AND (sa.is_active = true) AND ('conversations'::text = ANY (sa.permissions))))));


--
-- Name: faq_usage_logs Staff can view owner faq usage logs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner faq usage logs" ON "Ceylon_gems".faq_usage_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = faq_usage_logs.user_id) AND (sa.is_active = true) AND ('faqs'::text = ANY (sa.permissions))))));


--
-- Name: faqs Staff can view owner faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner faqs" ON "Ceylon_gems".faqs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = faqs.user_id) AND (sa.is_active = true) AND ('faqs'::text = ANY (sa.permissions))))));


--
-- Name: orders Staff can view owner orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner orders" ON "Ceylon_gems".orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = orders.user_id) AND (sa.is_active = true) AND ('orders'::text = ANY (sa.permissions))))));


--
-- Name: products Staff can view owner products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner products" ON "Ceylon_gems".products FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = products.user_id) AND (sa.is_active = true) AND ('products'::text = ANY (sa.permissions))))));


--
-- Name: profiles Staff can view owner profile; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner profile" ON "Ceylon_gems".profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = profiles.user_id) AND (sa.is_active = true)))));


--
-- Name: settings Staff can view owner settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner settings" ON "Ceylon_gems".settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = settings.user_id) AND (sa.is_active = true)))));


--
-- Name: chat_takeovers Staff can view owner takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff can view owner takeovers" ON "Ceylon_gems".chat_takeovers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "Ceylon_gems".staff_accounts sa
  WHERE ((sa.staff_user_id = auth.uid()) AND (sa.owner_id = chat_takeovers.user_id) AND (sa.is_active = true) AND ('conversations'::text = ANY (sa.permissions))))));


--
-- Name: leads Staff insert owner leads; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff insert owner leads" ON "Ceylon_gems".leads FOR INSERT TO authenticated WITH CHECK ("Ceylon_gems".is_staff_of(auth.uid(), user_id));


--
-- Name: leads Staff update owner leads; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff update owner leads" ON "Ceylon_gems".leads FOR UPDATE TO authenticated USING ("Ceylon_gems".is_staff_of(auth.uid(), user_id)) WITH CHECK ("Ceylon_gems".is_staff_of(auth.uid(), user_id));


--
-- Name: leads Staff view owner leads; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Staff view owner leads" ON "Ceylon_gems".leads FOR SELECT TO authenticated USING ("Ceylon_gems".is_staff_of(auth.uid(), user_id));


--
-- Name: faqs Super admins can delete all faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can delete all faqs" ON "Ceylon_gems".faqs FOR DELETE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: platform_settings Super admins can delete platform settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can delete platform settings" ON "Ceylon_gems".platform_settings FOR DELETE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: user_roles Super admins can delete roles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can delete roles" ON "Ceylon_gems".user_roles FOR DELETE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: platform_settings Super admins can insert platform settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can insert platform settings" ON "Ceylon_gems".platform_settings FOR INSERT WITH CHECK ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: user_roles Super admins can manage roles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can manage roles" ON "Ceylon_gems".user_roles FOR INSERT WITH CHECK ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: faqs Super admins can update all faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can update all faqs" ON "Ceylon_gems".faqs FOR UPDATE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: orders Super admins can update all orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can update all orders" ON "Ceylon_gems".orders FOR UPDATE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: profiles Super admins can update all profiles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can update all profiles" ON "Ceylon_gems".profiles FOR UPDATE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: settings Super admins can update all settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can update all settings" ON "Ceylon_gems".settings FOR UPDATE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: platform_settings Super admins can update platform settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can update platform settings" ON "Ceylon_gems".platform_settings FOR UPDATE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: user_roles Super admins can update roles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can update roles" ON "Ceylon_gems".user_roles FOR UPDATE USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: ai_usage_logs Super admins can view all ai usage logs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all ai usage logs" ON "Ceylon_gems".ai_usage_logs FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: contact_usage Super admins can view all contact usage; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all contact usage" ON "Ceylon_gems".contact_usage FOR SELECT TO authenticated USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: conversations Super admins can view all conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all conversations" ON "Ceylon_gems".conversations FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: faqs Super admins can view all faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all faqs" ON "Ceylon_gems".faqs FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: orders Super admins can view all orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all orders" ON "Ceylon_gems".orders FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: profiles Super admins can view all profiles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all profiles" ON "Ceylon_gems".profiles FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: user_wsender_sessions Super admins can view all sessions; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all sessions" ON "Ceylon_gems".user_wsender_sessions FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: settings Super admins can view all settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all settings" ON "Ceylon_gems".settings FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: staff_accounts Super admins can view all staff; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view all staff" ON "Ceylon_gems".staff_accounts FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: platform_settings Super admins can view platform settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins can view platform settings" ON "Ceylon_gems".platform_settings FOR SELECT USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: leads Super admins view all leads; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Super admins view all leads" ON "Ceylon_gems".leads FOR SELECT TO authenticated USING ("Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role));


--
-- Name: conversations Users can create own conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can create own conversations" ON "Ceylon_gems".conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: faqs Users can create own faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can create own faqs" ON "Ceylon_gems".faqs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: orders Users can create own orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can create own orders" ON "Ceylon_gems".orders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: products Users can create own products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can create own products" ON "Ceylon_gems".products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_wsender_sessions Users can create own sessions; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can create own sessions" ON "Ceylon_gems".user_wsender_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: settings Users can create own settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can create own settings" ON "Ceylon_gems".settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: conversations Users can delete own conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own conversations" ON "Ceylon_gems".conversations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: faqs Users can delete own faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own faqs" ON "Ceylon_gems".faqs FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: orders Users can delete own orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own orders" ON "Ceylon_gems".orders FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: products Users can delete own products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own products" ON "Ceylon_gems".products FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_wsender_sessions Users can delete own sessions; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own sessions" ON "Ceylon_gems".user_wsender_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: settings Users can delete own settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own settings" ON "Ceylon_gems".settings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: fcm_tokens Users can delete own tokens; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete own tokens" ON "Ceylon_gems".fcm_tokens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chat_takeovers Users can delete their own takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can delete their own takeovers" ON "Ceylon_gems".chat_takeovers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: fcm_tokens Users can insert own tokens; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can insert own tokens" ON "Ceylon_gems".fcm_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_takeovers Users can insert their own takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can insert their own takeovers" ON "Ceylon_gems".chat_takeovers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: conversations Users can update own conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own conversations" ON "Ceylon_gems".conversations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: faqs Users can update own faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own faqs" ON "Ceylon_gems".faqs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: orders Users can update own orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own orders" ON "Ceylon_gems".orders FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: products Users can update own products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own products" ON "Ceylon_gems".products FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_wsender_sessions Users can update own sessions; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own sessions" ON "Ceylon_gems".user_wsender_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: settings Users can update own settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own settings" ON "Ceylon_gems".settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: fcm_tokens Users can update own tokens; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update own tokens" ON "Ceylon_gems".fcm_tokens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update their own profile" ON "Ceylon_gems".profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chat_takeovers Users can update their own takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can update their own takeovers" ON "Ceylon_gems".chat_takeovers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ai_usage_logs Users can view own ai usage logs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own ai usage logs" ON "Ceylon_gems".ai_usage_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contact_usage Users can view own contact usage; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own contact usage" ON "Ceylon_gems".contact_usage FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR "Ceylon_gems".is_staff_of(auth.uid(), user_id)));


--
-- Name: conversations Users can view own conversations; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own conversations" ON "Ceylon_gems".conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: faq_usage_logs Users can view own faq usage logs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own faq usage logs" ON "Ceylon_gems".faq_usage_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: faqs Users can view own faqs; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own faqs" ON "Ceylon_gems".faqs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: orders Users can view own orders; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own orders" ON "Ceylon_gems".orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: products Users can view own products; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own products" ON "Ceylon_gems".products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own roles" ON "Ceylon_gems".user_roles FOR SELECT USING (((auth.uid() = user_id) OR "Ceylon_gems".has_role(auth.uid(), 'super_admin'::"Ceylon_gems".app_role)));


--
-- Name: user_wsender_sessions Users can view own sessions; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own sessions" ON "Ceylon_gems".user_wsender_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: settings Users can view own settings; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own settings" ON "Ceylon_gems".settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: fcm_tokens Users can view own tokens; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view own tokens" ON "Ceylon_gems".fcm_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view their own profile" ON "Ceylon_gems".profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_takeovers Users can view their own takeovers; Type: POLICY; Schema: "Ceylon_gems"; Owner: -
--

CREATE POLICY "Users can view their own takeovers" ON "Ceylon_gems".chat_takeovers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_usage_logs; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".ai_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_takeovers; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".chat_takeovers ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_usage; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".contact_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: faq_usage_logs; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".faq_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: fcm_tokens; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".fcm_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".leads ENABLE ROW LEVEL SECURITY;

--
-- Name: message_queue; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".message_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".orders ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".settings ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_accounts; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".staff_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wsender_sessions; Type: ROW SECURITY; Schema: "Ceylon_gems"; Owner: -
--

ALTER TABLE "Ceylon_gems".user_wsender_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "Ceylon_gems"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "Ceylon_gems" TO postgres;
GRANT USAGE ON SCHEMA "Ceylon_gems" TO anon;
GRANT USAGE ON SCHEMA "Ceylon_gems" TO authenticated;
GRANT USAGE ON SCHEMA "Ceylon_gems" TO service_role;


--
-- Name: FUNCTION can_read_usage(_user_id uuid); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".can_read_usage(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".can_read_usage(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".can_read_usage(_user_id uuid) TO service_role;


--
-- Name: FUNCTION enforce_order_limit(); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".enforce_order_limit() TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".enforce_order_limit() TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".enforce_order_limit() TO service_role;


--
-- Name: FUNCTION get_ai_message_usage(_user_id uuid, _since timestamp with time zone); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".get_ai_message_usage(_user_id uuid, _since timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".get_ai_message_usage(_user_id uuid, _since timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".get_ai_message_usage(_user_id uuid, _since timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_contact_usage(_user_id uuid, _since timestamp with time zone); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".get_contact_usage(_user_id uuid, _since timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".get_contact_usage(_user_id uuid, _since timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".get_contact_usage(_user_id uuid, _since timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_staff_owner_id(_user_id uuid); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".get_staff_owner_id(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".get_staff_owner_id(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".get_staff_owner_id(_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user() TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_new_user_role(); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user_role() TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user_role() TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user_role() TO service_role;


--
-- Name: FUNCTION handle_new_user_settings(); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user_settings() TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user_settings() TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".handle_new_user_settings() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role "Ceylon_gems".app_role); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".has_role(_user_id uuid, _role "Ceylon_gems".app_role) TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".has_role(_user_id uuid, _role "Ceylon_gems".app_role) TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".has_role(_user_id uuid, _role "Ceylon_gems".app_role) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".is_admin() TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".is_admin() TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".is_admin() TO service_role;


--
-- Name: FUNCTION is_staff_of(_staff_user_id uuid, _owner_id uuid); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".is_staff_of(_staff_user_id uuid, _owner_id uuid) TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".is_staff_of(_staff_user_id uuid, _owner_id uuid) TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".is_staff_of(_staff_user_id uuid, _owner_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON FUNCTION "Ceylon_gems".update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION "Ceylon_gems".update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION "Ceylon_gems".update_updated_at_column() TO service_role;


--
-- Name: TABLE ai_usage_logs; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".ai_usage_logs TO anon;
GRANT ALL ON TABLE "Ceylon_gems".ai_usage_logs TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".ai_usage_logs TO service_role;


--
-- Name: TABLE chat_takeovers; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".chat_takeovers TO anon;
GRANT ALL ON TABLE "Ceylon_gems".chat_takeovers TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".chat_takeovers TO service_role;


--
-- Name: TABLE contact_usage; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".contact_usage TO anon;
GRANT ALL ON TABLE "Ceylon_gems".contact_usage TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".contact_usage TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".conversations TO anon;
GRANT ALL ON TABLE "Ceylon_gems".conversations TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".conversations TO service_role;


--
-- Name: TABLE faq_usage_logs; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".faq_usage_logs TO anon;
GRANT ALL ON TABLE "Ceylon_gems".faq_usage_logs TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".faq_usage_logs TO service_role;


--
-- Name: TABLE faqs; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".faqs TO anon;
GRANT ALL ON TABLE "Ceylon_gems".faqs TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".faqs TO service_role;


--
-- Name: TABLE fcm_tokens; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".fcm_tokens TO anon;
GRANT ALL ON TABLE "Ceylon_gems".fcm_tokens TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".fcm_tokens TO service_role;


--
-- Name: TABLE leads; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".leads TO anon;
GRANT ALL ON TABLE "Ceylon_gems".leads TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".leads TO service_role;


--
-- Name: TABLE message_queue; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".message_queue TO anon;
GRANT ALL ON TABLE "Ceylon_gems".message_queue TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".message_queue TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".orders TO anon;
GRANT ALL ON TABLE "Ceylon_gems".orders TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".orders TO service_role;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".platform_settings TO anon;
GRANT ALL ON TABLE "Ceylon_gems".platform_settings TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".platform_settings TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".products TO anon;
GRANT ALL ON TABLE "Ceylon_gems".products TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".profiles TO anon;
GRANT ALL ON TABLE "Ceylon_gems".profiles TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".profiles TO service_role;


--
-- Name: TABLE settings; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".settings TO anon;
GRANT ALL ON TABLE "Ceylon_gems".settings TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".settings TO service_role;


--
-- Name: TABLE staff_accounts; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".staff_accounts TO anon;
GRANT ALL ON TABLE "Ceylon_gems".staff_accounts TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".staff_accounts TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".user_roles TO anon;
GRANT ALL ON TABLE "Ceylon_gems".user_roles TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".user_roles TO service_role;


--
-- Name: TABLE user_wsender_sessions; Type: ACL; Schema: "Ceylon_gems"; Owner: -
--

GRANT ALL ON TABLE "Ceylon_gems".user_wsender_sessions TO anon;
GRANT ALL ON TABLE "Ceylon_gems".user_wsender_sessions TO authenticated;
GRANT ALL ON TABLE "Ceylon_gems".user_wsender_sessions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: "Ceylon_gems"; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: "Ceylon_gems"; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: "Ceylon_gems"; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: "Ceylon_gems"; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: "Ceylon_gems"; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: "Ceylon_gems"; Owner: -
--



--
-- PostgreSQL database dump complete
--


--
-- Additional grants and default privileges for Ceylon_gems schema
--
GRANT USAGE ON SCHEMA "Ceylon_gems" TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "Ceylon_gems" TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "Ceylon_gems" TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "Ceylon_gems" TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "Ceylon_gems" GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "Ceylon_gems" GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "Ceylon_gems" GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

--
-- Auth triggers for automatic profile, role, and settings initialization
--
CREATE OR REPLACE TRIGGER on_auth_user_created_Ceylon_gems
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".handle_new_user();

CREATE OR REPLACE TRIGGER on_auth_user_created_role_Ceylon_gems
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".handle_new_user_role();

CREATE OR REPLACE TRIGGER on_auth_user_created_settings_Ceylon_gems
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "Ceylon_gems".handle_new_user_settings();


\unrestrict GCoNOs7mBfXioTfTnsPcdgMmKCwWOcfA0SlfN3WrM1XpO6Nhmj9aKeXA6JwDskO

