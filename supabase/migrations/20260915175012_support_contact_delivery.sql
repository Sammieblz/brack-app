CREATE TABLE public.support_delivery_requests (
  request_id uuid PRIMARY KEY,
  actor_fingerprint text NOT NULL CHECK (actor_fingerprint ~ '^[a-f0-9]{64}$'),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'accepted', 'failed')),
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  last_failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);

COMMENT ON TABLE public.support_delivery_requests IS
  'Service-only, content-free delivery receipts used to prevent duplicate support emails.';
COMMENT ON COLUMN public.support_delivery_requests.actor_fingerprint IS
  'Server-keyed digest of the authenticated account or anonymous network identity; never a raw IP or email.';
COMMENT ON COLUMN public.support_delivery_requests.payload_digest IS
  'Digest used to reject reuse of a request ID for different content; the support message itself is never stored here.';

ALTER TABLE public.support_delivery_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.support_delivery_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_delivery_requests TO service_role;

CREATE INDEX support_delivery_requests_unresolved_idx
  ON public.support_delivery_requests (updated_at)
  WHERE status <> 'accepted';

CREATE OR REPLACE FUNCTION public.claim_support_delivery(
  p_request_id uuid,
  p_actor_fingerprint text,
  p_payload_digest text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  claimed_record public.support_delivery_requests%ROWTYPE;
  existing_record public.support_delivery_requests%ROWTYPE;
BEGIN
  IF p_actor_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_payload_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid support delivery digest';
  END IF;

  INSERT INTO public.support_delivery_requests (
    request_id,
    actor_fingerprint,
    payload_digest
  )
  VALUES (p_request_id, p_actor_fingerprint, p_payload_digest)
  ON CONFLICT (request_id) DO UPDATE
  SET
    status = 'processing',
    provider_message_id = NULL,
    attempt_count = public.support_delivery_requests.attempt_count + 1,
    claimed_at = now(),
    accepted_at = NULL,
    last_failure_code = NULL,
    updated_at = now()
  WHERE public.support_delivery_requests.actor_fingerprint = EXCLUDED.actor_fingerprint
    AND public.support_delivery_requests.payload_digest = EXCLUDED.payload_digest
    AND (
      public.support_delivery_requests.status = 'failed'
      OR (
        public.support_delivery_requests.status = 'processing'
        AND public.support_delivery_requests.claimed_at < now() - interval '90 seconds'
      )
    )
  RETURNING * INTO claimed_record;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'state', 'claimed',
      'attempt_count', claimed_record.attempt_count
    );
  END IF;

  SELECT *
  INTO existing_record
  FROM public.support_delivery_requests
  WHERE request_id = p_request_id;

  IF existing_record.actor_fingerprint <> p_actor_fingerprint
    OR existing_record.payload_digest <> p_payload_digest THEN
    RETURN jsonb_build_object('state', 'conflict');
  END IF;

  RETURN jsonb_build_object(
    'state', CASE
      WHEN existing_record.status = 'accepted' THEN 'accepted'
      ELSE 'in_progress'
    END,
    'provider_message_id', existing_record.provider_message_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_support_delivery(
  p_request_id uuid,
  p_actor_fingerprint text,
  p_payload_digest text,
  p_accepted boolean,
  p_provider_message_id text DEFAULT NULL,
  p_failure_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  changed_count integer;
BEGIN
  UPDATE public.support_delivery_requests
  SET
    status = CASE WHEN p_accepted THEN 'accepted' ELSE 'failed' END,
    provider_message_id = CASE WHEN p_accepted THEN left(p_provider_message_id, 255) ELSE NULL END,
    accepted_at = CASE WHEN p_accepted THEN now() ELSE NULL END,
    last_failure_code = CASE WHEN p_accepted THEN NULL ELSE left(p_failure_code, 80) END,
    updated_at = now()
  WHERE request_id = p_request_id
    AND actor_fingerprint = p_actor_fingerprint
    AND payload_digest = p_payload_digest
    AND status = 'processing';

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_support_delivery(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_support_delivery(uuid, text, text, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_support_delivery(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_support_delivery(uuid, text, text, boolean, text, text)
  TO service_role;
