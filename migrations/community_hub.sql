-- Community Services (hub_*) tables.
-- Additive only: no existing table is altered or dropped.
-- Generated from server/communityHub.ts HUB_DDL; tests/communityHub.migration.test.ts
-- asserts the two stay identical. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS hub_organisations (
  id uuid PRIMARY KEY,
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('municipality','police','fire','security')),
  country text NOT NULL,
  city text NOT NULL,
  description text NOT NULL,
  contact_email text NOT NULL,
  phone text NOT NULL,
  website text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  review_note text,
  reviewed_by varchar REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_org_name_location
  ON hub_organisations (lower(name), lower(country), lower(city));
CREATE INDEX IF NOT EXISTS hub_org_owner ON hub_organisations (owner_id);

CREATE TABLE IF NOT EXISTS hub_memberships (
  organisation_id uuid NOT NULL REFERENCES hub_organisations(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'resident' CHECK (role IN ('resident','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, user_id)
);
CREATE INDEX IF NOT EXISTS hub_membership_user ON hub_memberships (user_id);

CREATE TABLE IF NOT EXISTS hub_requests (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES hub_organisations(id) ON DELETE CASCADE,
  requester_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  payload_fingerprint text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  neighbourhood text NOT NULL,
  location text NOT NULL,
  state text NOT NULL DEFAULT 'submitted'
    CHECK (state IN ('submitted','acknowledged','in_progress','resolved','closed')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, idempotency_key)
);
ALTER TABLE hub_requests ADD COLUMN IF NOT EXISTS payload_fingerprint text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS hub_request_owner ON hub_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hub_request_org ON hub_requests (organisation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hub_request_updates (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES hub_requests(id) ON DELETE CASCADE,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_request_update_request
  ON hub_request_updates (request_id, created_at);

CREATE TABLE IF NOT EXISTS hub_notices (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES hub_organisations(id) ON DELETE CASCADE,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_notice_org ON hub_notices (organisation_id, created_at DESC);
