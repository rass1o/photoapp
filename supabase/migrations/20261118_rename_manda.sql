-- Mand the red panda is now Manda. Only the name changes: the item id and
-- value stay the same, so anyone who already owns her keeps her.
-- Run after 20261117_soupy.sql.

update public.shop_items set label = 'Manda' where id = 'octo-pet-mand';
