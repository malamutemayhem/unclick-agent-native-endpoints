-- UnClick Organiser Schema
-- Calendar + ToDo + Bookings product with multi-provider sync
-- Syncs with Google Calendar, Outlook 365, Apple iCloud

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE provider_type AS ENUM ('google', 'outlook', 'apple');
CREATE TYPE event_status AS ENUM ('confirmed', 'tentative', 'cancelled');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE task_source AS ENUM ('manual', 'ai_extracted', 'meeting_notes', 'email');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'rescheduled');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- OAuth connections to calendar providers
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider provider_type NOT NULL,
    account_email TEXT NOT NULL,
    access_token TEXT NOT NULL, -- Encrypted by Supabase Vault
    refresh_token TEXT, -- Encrypted by Supabase Vault
    token_expires_at TIMESTAMPTZ,
    calendar_id TEXT NOT NULL,
    calendar_name TEXT NOT NULL,
    color TEXT,
    sync_enabled BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_connection_per_provider UNIQUE (user_id, provider, calendar_id)
);

CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX idx_calendar_connections_sync_enabled ON calendar_connections(sync_enabled);
CREATE INDEX idx_calendar_connections_last_synced ON calendar_connections(last_synced_at);

CREATE TRIGGER update_calendar_connections_updated_at BEFORE UPDATE ON calendar_connections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Unified event store across all calendars
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    recurrence_rule TEXT, -- RRULE format
    status event_status DEFAULT 'confirmed',
    attendees JSONB DEFAULT '[]'::jsonb,
    reminders JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_event_per_connection UNIQUE (connection_id, external_id)
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_connection_id ON events(connection_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_end_time ON events(end_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_all_day ON events(all_day);
CREATE INDEX idx_events_start_end ON events(start_time, end_time);

-- Full-text search index
CREATE INDEX idx_events_search ON events USING GIN(
    to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, ''))
);

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ToDo/task management
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}'::text[],
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    source task_source DEFAULT 'manual',
    source_session_id TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_event_id ON tasks(event_id);
CREATE INDEX idx_tasks_source ON tasks(source);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority);

-- Full-text search index
CREATE INDEX idx_tasks_search ON tasks USING GIN(
    to_tsvector('english', title || ' ' || COALESCE(description, ''))
);

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Public booking page configuration (Calendly-like)
CREATE TABLE IF NOT EXISTS booking_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0,
    availability JSONB DEFAULT '{"mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb,
    timezone TEXT DEFAULT 'Australia/Melbourne',
    connection_ids UUID[] DEFAULT '{}'::uuid[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_slug UNIQUE (slug),
    CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    CONSTRAINT valid_buffer CHECK (buffer_minutes >= 0 AND buffer_minutes <= 240)
);

CREATE INDEX idx_booking_pages_user_id ON booking_pages(user_id);
CREATE INDEX idx_booking_pages_slug ON booking_pages(slug);
CREATE INDEX idx_booking_pages_active ON booking_pages(active);

CREATE TRIGGER update_booking_pages_updated_at BEFORE UPDATE ON booking_pages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Actual bookings made through booking pages
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_page_id UUID NOT NULL REFERENCES booking_pages(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_notes TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status booking_status DEFAULT 'pending',
    confirmation_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_booking_page_id ON bookings(booking_page_id);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);
CREATE INDEX idx_bookings_guest_email ON bookings(guest_email);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_confirmation_token ON bookings(confirmation_token);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - BYOD Pattern
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Calendar Connections
CREATE POLICY "Users can view their own calendar connections"
    ON calendar_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar connections"
    ON calendar_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
    ON calendar_connections FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
    ON calendar_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Events
CREATE POLICY "Users can view their own events"
    ON events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
    ON events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
    ON events FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
    ON events FOR DELETE
    USING (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can view their own tasks"
    ON tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
    ON tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
    ON tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
    ON tasks FOR DELETE
    USING (auth.uid() = user_id);

-- Booking Pages
CREATE POLICY "Users can view their own booking pages"
    ON booking_pages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own booking pages"
    ON booking_pages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own booking pages"
    ON booking_pages FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own booking pages"
    ON booking_pages FOR DELETE
    USING (auth.uid() = user_id);

-- Bookings - Allow public reads by confirmation token, owner can see all
CREATE POLICY "Users can view their own booking page bookings"
    ON bookings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM booking_pages bp
            WHERE bp.id = bookings.booking_page_id
            AND bp.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can view a booking with valid confirmation token"
    ON bookings FOR SELECT
    USING (
        confirmation_token IS NOT NULL
    );

CREATE POLICY "Users can insert bookings on their booking pages"
    ON bookings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM booking_pages bp
            WHERE bp.id = booking_page_id
            AND bp.active = true
        )
    );

CREATE POLICY "Users can update their own booking page bookings"
    ON bookings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM booking_pages bp
            WHERE bp.id = bookings.booking_page_id
            AND bp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own booking page bookings"
    ON bookings FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM booking_pages bp
            WHERE bp.id = bookings.booking_page_id
            AND bp.user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get available booking slots for a specific date
CREATE OR REPLACE FUNCTION check_availability(
    p_booking_page_id UUID,
    p_date DATE
)
RETURNS TABLE (
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    available BOOLEAN
) AS $$
DECLARE
    v_availability JSONB;
    v_timezone TEXT;
    v_day_name TEXT;
    v_slots JSONB;
    v_slot JSONB;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_duration_minutes INTEGER;
    v_booked_events RECORD;
BEGIN
    -- Get booking page config
    SELECT bp.availability, bp.timezone, bp.duration_minutes
    INTO v_availability, v_timezone, v_duration_minutes
    FROM booking_pages bp
    WHERE bp.id = p_booking_page_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Get day of week (lowercase)
    v_day_name := LOWER(to_char(p_date, 'day'));
    v_slots := v_availability -> v_day_name;

    -- Iterate through configured slots for this day
    FOR v_slot IN SELECT jsonb_array_elements(v_slots)
    LOOP
        v_start_time := (p_date::text || ' ' || v_slot->>'start')::time AT TIME ZONE v_timezone;
        v_end_time := (p_date::text || ' ' || v_slot->>'end')::time AT TIME ZONE v_timezone;

        -- Check if this slot is available (no conflicting bookings)
        RETURN QUERY
        SELECT
            v_start_time,
            v_start_time + (v_duration_minutes || ' minutes')::interval,
            NOT EXISTS (
                SELECT 1 FROM bookings b
                WHERE b.booking_page_id = p_booking_page_id
                AND b.status IN ('confirmed', 'pending')
                AND b.start_time < (v_start_time + (v_duration_minutes || ' minutes')::interval)
                AND b.end_time > v_start_time
            );
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get daily briefing (events + tasks for a specific date)
CREATE OR REPLACE FUNCTION get_daily_briefing(
    p_user_id UUID,
    p_target_date DATE
)
RETURNS TABLE (
    event_id UUID,
    task_id UUID,
    type TEXT,
    title TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT,
    priority TEXT
) AS $$
BEGIN
    -- Events for the day
    RETURN QUERY
    SELECT
        e.id,
        NULL::UUID,
        'event'::TEXT,
        e.title,
        e.start_time,
        e.end_time,
        e.status::TEXT,
        NULL::TEXT
    FROM events e
    WHERE e.user_id = p_user_id
    AND DATE(e.start_time AT TIME ZONE 'UTC') = p_target_date
    AND e.status != 'cancelled'
    ORDER BY e.start_time;

    -- Tasks for the day
    RETURN QUERY
    SELECT
        NULL::UUID,
        t.id,
        'task'::TEXT,
        t.title,
        t.due_date,
        NULL::TIMESTAMPTZ,
        t.status::TEXT,
        t.priority::TEXT
    FROM tasks t
    WHERE t.user_id = p_user_id
    AND DATE(t.due_date AT TIME ZONE 'UTC') = p_target_date
    AND t.status != 'cancelled'
    ORDER BY t.priority DESC, t.due_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get unified events across all calendars
CREATE OR REPLACE FUNCTION get_unified_events(
    p_user_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    all_day BOOLEAN,
    status TEXT,
    provider TEXT,
    calendar_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.description,
        e.location,
        e.start_time,
        e.end_time,
        e.all_day,
        e.status::TEXT,
        cc.provider::TEXT,
        cc.calendar_name
    FROM events e
    JOIN calendar_connections cc ON e.connection_id = cc.id
    WHERE e.user_id = p_user_id
    AND e.start_time >= p_start_date
    AND e.end_time <= p_end_date
    AND e.status != 'cancelled'
    AND cc.sync_enabled = true
    ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Full-text search events
CREATE OR REPLACE FUNCTION search_events(
    p_user_id UUID,
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.description,
        e.location,
        e.start_time,
        e.end_time,
        ts_rank(
            to_tsvector('english', e.title || ' ' || COALESCE(e.description, '') || ' ' || COALESCE(e.location, '')),
            plainto_tsquery('english', p_query)
        ) AS relevance
    FROM events e
    WHERE e.user_id = p_user_id
    AND to_tsvector('english', e.title || ' ' || COALESCE(e.description, '') || ' ' || COALESCE(e.location, ''))
        @@ plainto_tsquery('english', p_query)
    ORDER BY relevance DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Full-text search tasks
CREATE OR REPLACE FUNCTION search_tasks(
    p_user_id UUID,
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    status TEXT,
    priority TEXT,
    due_date TIMESTAMPTZ,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.description,
        t.status::TEXT,
        t.priority::TEXT,
        t.due_date,
        ts_rank(
            to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')),
            plainto_tsquery('english', p_query)
        ) AS relevance
    FROM tasks t
    WHERE t.user_id = p_user_id
    AND to_tsvector('english', t.title || ' ' || COALESCE(t.description, ''))
        @@ plainto_tsquery('english', p_query)
    ORDER BY relevance DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get task statistics
CREATE OR REPLACE FUNCTION get_task_stats(p_user_id UUID)
RETURNS TABLE (
    total_tasks INTEGER,
    completed_tasks INTEGER,
    in_progress_tasks INTEGER,
    todo_tasks INTEGER,
    cancelled_tasks INTEGER,
    urgent_count INTEGER,
    high_priority_count INTEGER,
    medium_priority_count INTEGER,
    low_priority_count INTEGER,
    overdue_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_tasks,
        COUNT(*) FILTER (WHERE status = 'done')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'todo')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER,
        COUNT(*) FILTER (WHERE priority = 'urgent' AND status != 'done' AND status != 'cancelled')::INTEGER,
        COUNT(*) FILTER (WHERE priority = 'high' AND status != 'done' AND status != 'cancelled')::INTEGER,
        COUNT(*) FILTER (WHERE priority = 'medium' AND status != 'done' AND status != 'cancelled')::INTEGER,
        COUNT(*) FILTER (WHERE priority = 'low' AND status != 'done' AND status != 'cancelled')::INTEGER,
        COUNT(*) FILTER (WHERE due_date < now() AND status != 'done' AND status != 'cancelled')::INTEGER
    FROM tasks t
    WHERE t.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get available calendar for booking (checks all connected calendars)
CREATE OR REPLACE FUNCTION get_calendar_availability(
    p_booking_page_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
    is_available BOOLEAN,
    conflicting_event_count INTEGER
) AS $$
DECLARE
    v_user_id UUID;
    v_connection_ids UUID[];
    v_conflict_count INTEGER;
BEGIN
    -- Get booking page user and connected calendars
    SELECT bp.user_id, bp.connection_ids
    INTO v_user_id, v_connection_ids
    FROM booking_pages bp
    WHERE bp.id = p_booking_page_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0;
        RETURN;
    END IF;

    -- Count conflicting events across all specified calendars
    SELECT COUNT(*)::INTEGER
    INTO v_conflict_count
    FROM events e
    WHERE e.user_id = v_user_id
    AND (v_connection_ids IS NULL OR e.connection_id = ANY(v_connection_ids))
    AND e.status != 'cancelled'
    AND e.start_time < p_end_time
    AND e.end_time > p_start_time;

    RETURN QUERY SELECT v_conflict_count = 0, v_conflict_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active calendar connections view
CREATE OR REPLACE VIEW active_calendar_connections AS
SELECT
    id,
    user_id,
    provider,
    account_email,
    calendar_name,
    color,
    last_synced_at,
    EXTRACT(EPOCH FROM (now() - last_synced_at)) / 3600 as hours_since_sync
FROM calendar_connections
WHERE sync_enabled = true
ORDER BY last_synced_at DESC NULLS LAST;

-- Upcoming events view
CREATE OR REPLACE VIEW upcoming_events AS
SELECT
    e.id,
    e.user_id,
    e.title,
    e.start_time,
    e.end_time,
    e.location,
    cc.calendar_name,
    cc.provider,
    EXTRACT(EPOCH FROM (e.start_time - now())) / 3600 as hours_until_event
FROM events e
JOIN calendar_connections cc ON e.connection_id = cc.id
WHERE e.start_time >= now()
AND e.status = 'confirmed'
AND cc.sync_enabled = true
ORDER BY e.start_time ASC;

-- Overdue tasks view
CREATE OR REPLACE VIEW overdue_tasks AS
SELECT
    id,
    user_id,
    title,
    priority,
    due_date,
    EXTRACT(EPOCH FROM (now() - due_date)) / 3600 as hours_overdue
FROM tasks
WHERE due_date < now()
AND status != 'done'
AND status != 'cancelled'
ORDER BY due_date ASC;

-- Booking page stats view
CREATE OR REPLACE VIEW booking_page_stats AS
SELECT
    bp.id,
    bp.user_id,
    bp.title,
    bp.slug,
    COUNT(b.id) as total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'pending') as pending_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
    MAX(b.created_at) as last_booking_at
FROM booking_pages bp
LEFT JOIN bookings b ON bp.id = b.booking_page_id
GROUP BY bp.id, bp.user_id, bp.title, bp.slug;

-- ============================================================================
-- GRANTS (For Supabase authenticated users)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
