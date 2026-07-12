CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.order_status_master (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    status_code VARCHAR(50) NOT NULL UNIQUE,

    status_name VARCHAR(100) NOT NULL,

    fulfillment_method VARCHAR(20) NOT NULL
        CHECK (fulfillment_method IN ('Pickup','Delivery','Both')),

    display_order INT NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
