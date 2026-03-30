-- ============================================================
-- AIoT Smart Road Monitor — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS potholes (
  id            BIGSERIAL PRIMARY KEY,
  lat           REAL        NOT NULL,
  lng           REAL        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'medium'
                            CHECK (severity IN ('low','medium','high','critical')),
  source        TEXT        NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('ai_camera','esp32_sensor','manual')),
  image_url     TEXT,
  description   TEXT,
  status        TEXT        NOT NULL DEFAULT 'detected'
                            CHECK (status IN ('detected','confirmed','in_repair','repaired')),
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  repaired_at   TIMESTAMPTZ,
  maintenance_notes TEXT,
  road_name     TEXT,
  confidence    REAL        DEFAULT 0.0,
  area          REAL        DEFAULT 0,
  volume        REAL        DEFAULT 0,
  cost          INTEGER     DEFAULT 0,
  state         TEXT,
  district      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensor_data (
  id                BIGSERIAL PRIMARY KEY,
  device_id         TEXT        NOT NULL,
  vibration_level   REAL        NOT NULL,
  lat               REAL,
  lng               REAL,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
  pothole_detected  SMALLINT    NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'viewer'
                            CHECK (role IN ('admin','viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id          BIGSERIAL PRIMARY KEY,
  pothole_id  BIGINT      REFERENCES potholes(id) ON DELETE SET NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'detection'
                          CHECK (type IN ('detection','severity_change','repair')),
  read        SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_potholes_status      ON potholes(status);
CREATE INDEX IF NOT EXISTS idx_potholes_severity     ON potholes(severity);
CREATE INDEX IF NOT EXISTS idx_potholes_detected_at  ON potholes(detected_at);
CREATE INDEX IF NOT EXISTS idx_potholes_state        ON potholes(state);
CREATE INDEX IF NOT EXISTS idx_potholes_district     ON potholes(district);
CREATE INDEX IF NOT EXISTS idx_sensor_device         ON sensor_data(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_timestamp      ON sensor_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_read           ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_alerts_pothole        ON alerts(pothole_id);

-- ────────────────────────────────────────────────────────────
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_potholes_updated_at ON potholes;
CREATE TRIGGER trg_potholes_updated_at
  BEFORE UPDATE ON potholes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 4. ROW-LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE potholes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (backend uses service_role key)
-- The service_role bypasses RLS by default in Supabase.

-- Allow anon (frontend) read-only access to potholes and alerts
CREATE POLICY "anon_read_potholes"  ON potholes  FOR SELECT USING (true);
CREATE POLICY "anon_read_alerts"    ON alerts     FOR SELECT USING (true);
CREATE POLICY "anon_read_sensors"   ON sensor_data FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────
-- 5. RPC FUNCTIONS (complex analytics that can't use the
--    Supabase query builder directly)
-- ────────────────────────────────────────────────────────────

-- 5a. Daily detection frequency (last 30 days)
CREATE OR REPLACE FUNCTION get_daily_frequency(
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(day DATE, count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT detected_at::date AS day, COUNT(*) AS count
    FROM potholes
    WHERE detected_at >= now() - INTERVAL '30 days'
      AND (p_state IS NULL OR state = p_state)
      AND (p_district IS NULL OR district = p_district)
    GROUP BY detected_at::date
    ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5b. Risk areas (top 10 hotspots)
CREATE OR REPLACE FUNCTION get_risk_areas(
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(
  road_name TEXT,
  area_lat NUMERIC,
  area_lng NUMERIC,
  pothole_count BIGINT,
  risk_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.road_name,
      ROUND(p.lat::numeric, 3) AS area_lat,
      ROUND(p.lng::numeric, 3) AS area_lng,
      COUNT(*) AS pothole_count,
      SUM(CASE
        WHEN p.severity = 'critical' THEN 4
        WHEN p.severity = 'high'     THEN 3
        WHEN p.severity = 'medium'   THEN 2
        ELSE 1
      END) AS risk_score
    FROM potholes p
    WHERE p.status != 'repaired'
      AND (p_state IS NULL OR p.state = p_state)
      AND (p_district IS NULL OR p.district = p_district)
    GROUP BY ROUND(p.lat::numeric, 3), ROUND(p.lng::numeric, 3), p.road_name
    ORDER BY risk_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5c. Source distribution
CREATE OR REPLACE FUNCTION get_source_distribution(
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(source TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT p.source, COUNT(*) AS count
    FROM potholes p
    WHERE (p_state IS NULL OR p.state = p_state)
      AND (p_district IS NULL OR p.district = p_district)
    GROUP BY p.source;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5d. Monthly trend (last 12 months)
CREATE OR REPLACE FUNCTION get_monthly_trend(
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(month TEXT, total BIGINT, repaired BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT
      TO_CHAR(p.detected_at, 'YYYY-MM') AS month,
      COUNT(*) AS total,
      SUM(CASE WHEN p.status = 'repaired' THEN 1 ELSE 0 END) AS repaired
    FROM potholes p
    WHERE p.detected_at >= now() - INTERVAL '12 months'
      AND (p_state IS NULL OR p.state = p_state)
      AND (p_district IS NULL OR p.district = p_district)
    GROUP BY TO_CHAR(p.detected_at, 'YYYY-MM')
    ORDER BY month ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5e. Confidence trends (last 24 hours)
CREATE OR REPLACE FUNCTION get_confidence_trends(
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(hour TEXT, avg_confidence NUMERIC, max_confidence NUMERIC, min_confidence NUMERIC, detections BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT
      TO_CHAR(p.detected_at, 'YYYY-MM-DD HH24:00:00') AS hour,
      ROUND(AVG(p.confidence)::numeric, 3) AS avg_confidence,
      ROUND(MAX(p.confidence)::numeric, 3) AS max_confidence,
      ROUND(MIN(p.confidence)::numeric, 3) AS min_confidence,
      COUNT(*) AS detections
    FROM potholes p
    WHERE p.detected_at >= now() - INTERVAL '24 hours'
      AND p.confidence > 0
      AND (p_state IS NULL OR p.state = p_state)
      AND (p_district IS NULL OR p.district = p_district)
    GROUP BY TO_CHAR(p.detected_at, 'YYYY-MM-DD HH24:00:00')
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5f. Vibration trends for sensor data
CREATE OR REPLACE FUNCTION get_vibration_trends(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(hour TEXT, avg_vibration NUMERIC, max_vibration NUMERIC, min_vibration NUMERIC, readings BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT
      TO_CHAR(s.timestamp, 'YYYY-MM-DD HH24:00:00') AS hour,
      ROUND(AVG(s.vibration_level)::numeric, 2) AS avg_vibration,
      ROUND(MAX(s.vibration_level)::numeric, 2) AS max_vibration,
      ROUND(MIN(s.vibration_level)::numeric, 2) AS min_vibration,
      COUNT(*) AS readings
    FROM sensor_data s
    WHERE s.timestamp >= now() - (INTERVAL '1 hour' * p_hours)
    GROUP BY TO_CHAR(s.timestamp, 'YYYY-MM-DD HH24:00:00')
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5g. Report data (used by reportRoutes)
CREATE OR REPLACE FUNCTION get_report_data(
  p_period TEXT DEFAULT 'daily',
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(
  label TEXT,
  count BIGINT,
  critical BIGINT,
  high BIGINT,
  medium BIGINT,
  low BIGINT,
  repaired BIGINT,
  total_cost NUMERIC,
  avg_confidence NUMERIC
) AS $$
DECLARE
  v_group_expr TEXT;
  v_label_expr TEXT;
  v_date_filter TEXT;
BEGIN
  IF p_period = 'yearly' THEN
    v_group_expr := 'TO_CHAR(detected_at, ''YYYY'')';
    v_date_filter := 'detected_at >= now() - INTERVAL ''5 years''';
  ELSIF p_period = 'monthly' THEN
    v_group_expr := 'TO_CHAR(detected_at, ''YYYY-MM'')';
    v_date_filter := 'detected_at >= now() - INTERVAL ''12 months''';
  ELSE
    v_group_expr := 'TO_CHAR(detected_at, ''YYYY-MM-DD'')';
    v_date_filter := 'detected_at >= now() - INTERVAL ''30 days''';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT
      %s AS label,
      COUNT(*) AS count,
      SUM(CASE WHEN severity = ''critical'' THEN 1 ELSE 0 END) AS critical,
      SUM(CASE WHEN severity = ''high'' THEN 1 ELSE 0 END) AS high,
      SUM(CASE WHEN severity = ''medium'' THEN 1 ELSE 0 END) AS medium,
      SUM(CASE WHEN severity = ''low'' THEN 1 ELSE 0 END) AS low,
      SUM(CASE WHEN status = ''repaired'' THEN 1 ELSE 0 END) AS repaired,
      ROUND(COALESCE(SUM(cost), 0)::numeric, 2) AS total_cost,
      ROUND(COALESCE(AVG(confidence), 0)::numeric, 3) AS avg_confidence
    FROM potholes
    WHERE %s
      AND ($1 IS NULL OR state = $1)
      AND ($2 IS NULL OR district = $2)
    GROUP BY %s
    ORDER BY label ASC',
    v_group_expr, v_date_filter, v_group_expr
  ) USING p_state, p_district;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5h. Report summary
CREATE OR REPLACE FUNCTION get_report_summary(
  p_period TEXT DEFAULT 'daily',
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(
  total_detections BIGINT,
  critical_count BIGINT,
  high_count BIGINT,
  medium_count BIGINT,
  low_count BIGINT,
  repaired_count BIGINT,
  total_cost NUMERIC,
  avg_confidence NUMERIC
) AS $$
DECLARE
  v_date_filter TEXT;
BEGIN
  IF p_period = 'yearly' THEN
    v_date_filter := 'detected_at >= now() - INTERVAL ''5 years''';
  ELSIF p_period = 'monthly' THEN
    v_date_filter := 'detected_at >= now() - INTERVAL ''12 months''';
  ELSE
    v_date_filter := 'detected_at >= now() - INTERVAL ''30 days''';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT
      COUNT(*) AS total_detections,
      SUM(CASE WHEN severity = ''critical'' THEN 1 ELSE 0 END) AS critical_count,
      SUM(CASE WHEN severity = ''high'' THEN 1 ELSE 0 END) AS high_count,
      SUM(CASE WHEN severity = ''medium'' THEN 1 ELSE 0 END) AS medium_count,
      SUM(CASE WHEN severity = ''low'' THEN 1 ELSE 0 END) AS low_count,
      SUM(CASE WHEN status = ''repaired'' THEN 1 ELSE 0 END) AS repaired_count,
      ROUND(COALESCE(SUM(cost), 0)::numeric, 2) AS total_cost,
      ROUND(COALESCE(AVG(confidence), 0)::numeric, 3) AS avg_confidence
    FROM potholes
    WHERE %s
      AND ($1 IS NULL OR state = $1)
      AND ($2 IS NULL OR district = $2)',
    v_date_filter
  ) USING p_state, p_district;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5i. Top roads for reports
CREATE OR REPLACE FUNCTION get_top_roads(
  p_period TEXT DEFAULT 'daily',
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(road_name TEXT, count BIGINT, total_cost NUMERIC) AS $$
DECLARE
  v_date_filter TEXT;
BEGIN
  IF p_period = 'yearly' THEN
    v_date_filter := 'detected_at >= now() - INTERVAL ''5 years''';
  ELSIF p_period = 'monthly' THEN
    v_date_filter := 'detected_at >= now() - INTERVAL ''12 months''';
  ELSE
    v_date_filter := 'detected_at >= now() - INTERVAL ''30 days''';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT
      p.road_name,
      COUNT(*) AS count,
      ROUND(COALESCE(SUM(p.cost), 0)::numeric, 2) AS total_cost
    FROM potholes p
    WHERE %s
      AND p.road_name IS NOT NULL AND p.road_name != ''''
      AND ($1 IS NULL OR p.state = $1)
      AND ($2 IS NULL OR p.district = $2)
    GROUP BY p.road_name
    ORDER BY count DESC
    LIMIT 10',
    v_date_filter
  ) USING p_state, p_district;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5j. Pothole stats (weighted score for road health index)
CREATE OR REPLACE FUNCTION get_pothole_stats(
  p_state TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL
)
RETURNS TABLE(
  total BIGINT,
  active BIGINT,
  detected BIGINT,
  confirmed BIGINT,
  in_repair BIGINT,
  repaired BIGINT,
  today_detections BIGINT,
  weighted_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE p.status != 'repaired')::BIGINT AS active,
      COUNT(*) FILTER (WHERE p.status = 'detected')::BIGINT AS detected,
      COUNT(*) FILTER (WHERE p.status = 'confirmed')::BIGINT AS confirmed,
      COUNT(*) FILTER (WHERE p.status = 'in_repair')::BIGINT AS in_repair,
      COUNT(*) FILTER (WHERE p.status = 'repaired')::BIGINT AS repaired,
      COUNT(*) FILTER (WHERE p.status != 'repaired' AND p.detected_at::date = CURRENT_DATE)::BIGINT AS today_detections,
      COALESCE(SUM(
        CASE WHEN p.status != 'repaired' THEN
          CASE
            WHEN p.severity = 'critical' THEN 25
            WHEN p.severity = 'high'     THEN 15
            WHEN p.severity = 'medium'   THEN 8
            ELSE 3
          END
        ELSE 0 END
      ), 0)::BIGINT AS weighted_score
    FROM potholes p
    WHERE (p_state IS NULL OR LOWER(p.state) LIKE LOWER('%' || p_state || '%'))
      AND (p_district IS NULL OR LOWER(p.district) LIKE LOWER('%' || p_district || '%'));
END;
$$ LANGUAGE plpgsql STABLE;
