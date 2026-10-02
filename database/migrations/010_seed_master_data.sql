INSERT INTO public.order_status_master
(
    status_code,
    status_name,
    fulfillment_method,
    display_order
)
VALUES

('ORDER_RECEIVED','Order Received','Both',1),

('PREPARING','Preparing','Both',2),

('READY_FOR_PICKUP','Ready for Pickup','Pickup',3),

('PICKED_UP','Picked Up','Pickup',4),

('PACKED','Packed','Delivery',3),

('SHIPPED','Shipped','Delivery',4),

('OUT_FOR_DELIVERY','Out For Delivery','Delivery',5),

('DELIVERED','Delivered','Delivery',6),

('CANCELLED','Cancelled','Both',99);

INSERT INTO public.courier_master
(
    courier_code,
    courier_name,
    website,
    tracking_url,
    support_email,
    support_phone
)
VALUES

(
'DTDC',
'DTDC',
'https://www.dtdc.in',
'https://www.dtdc.in/tracking',
NULL,
NULL
),

(
'BLUEDART',
'Blue Dart',
'https://www.bluedart.com',
'https://www.bluedart.com/tracking',
NULL,
NULL
),

(
'DELHIVERY',
'Delhivery',
'https://www.delhivery.com',
'https://www.delhivery.com/tracking',
NULL,
NULL
),

(
'INDIA_POST',
'India Post',
'https://www.indiapost.gov.in',
'https://www.indiapost.gov.in',
NULL,
NULL
),

(
'XPRESSBEES',
'XpressBees',
'https://www.xpressbees.com',
'https://www.xpressbees.com',
NULL,
NULL
),

(
'EKART',
'Ekart',
NULL,
NULL,
NULL,
NULL
);

INSERT INTO public.sync_checkpoint
(
    checkpoint_name,
    last_successful_sync
)
VALUES
(
    'GOOGLE_SHEETS_SYNC',
    NULL
);

INSERT INTO public.application_config
(
    config_key,
    config_value,
    description
)
VALUES

(
'APPLICATION_NAME',
'PurelyJid Order Tracker',
'Application display name'
),

(
'SYNC_INTERVAL_MINUTES',
'5',
'Polling interval in minutes'
),

(
'ENABLE_SYNC',
'true',
'Enable or disable Google Sheets synchronization'
),

(
'MAINTENANCE_MODE',
'false',
'Enable maintenance mode'
),

(
'DEFAULT_COUNTRY',
'India',
'Default country for courier tracking'
);
