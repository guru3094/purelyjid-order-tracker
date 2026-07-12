INSERT INTO public.order_status_master
(status_code,status_name,fulfillment_method,display_order)

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
