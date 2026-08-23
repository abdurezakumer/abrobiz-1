-- ============================================================================
-- 0020_demo_business_seed.sql
-- Seed a complete, editable demo website for every new owner.
-- ============================================================================

create or replace function public.create_business_with_trial(
  p_name text,
  p_slug text,
  p_category_id uuid
)
returns public.businesses
language plpgsql
security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_trial_plan public.plans;
  v_category_slug text;
  v_category_id uuid;
  v_second_category_id uuid;
  v_third_category_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a business';
  end if;

  if exists (select 1 from public.businesses where owner_id = auth.uid()) then
    raise exception 'You already have a business on this account';
  end if;

  select slug into v_category_slug
  from public.business_categories
  where id = p_category_id and is_active;
  if v_category_slug is null then
    raise exception 'Please choose an active business category';
  end if;

  insert into public.businesses (owner_id, name, slug, category_id)
  values (auth.uid(), nullif(trim(p_name), ''), lower(trim(p_slug)), p_category_id)
  returning * into v_business;

  select * into v_trial_plan
  from public.plans
  where is_trial and is_active
  order by sort_order
  limit 1;
  if v_trial_plan.id is null then
    raise exception 'No active trial plan is configured';
  end if;

  insert into public.subscriptions (business_id, plan_id, status, start_date, end_date)
  values (v_business.id, v_trial_plan.id, 'trial', current_date,
          current_date + make_interval(days => coalesce(v_trial_plan.trial_days, 14)));

  if v_category_slug in ('restaurant', 'cafe') then
    update public.businesses
    set description = 'A warm, welcoming place for memorable food, coffee and time together.',
        about_content = format('Welcome to %s. We serve generous plates, thoughtful drinks and a relaxed experience made for everyday visits and special moments.', p_name),
        phone = '+251 911 234 567', email = 'hello@example.com', address = 'Bole, Addis Ababa, Ethiopia',
        gallery_urls = array[
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85',
          'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85'
        ]
    where id = v_business.id;

    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Starters', 'Sparkles', 0) returning id into v_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, image_url, translations)
    values
      (v_business.id, v_category_id, 280, true, 0, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', jsonb_build_object('en', jsonb_build_object('name', 'Roasted Garden Plate', 'description', 'Seasonal vegetables, herbs and house dressing.'))),
      (v_business.id, v_category_id, 320, true, 1, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=85', jsonb_build_object('en', jsonb_build_object('name', 'Spiced Lentil Bowl', 'description', 'Slow-cooked lentils with fresh greens and warm spices.')));

    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Main Dishes', 'UtensilsCrossed', 1) returning id into v_second_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, image_url, translations)
    values
      (v_business.id, v_second_category_id, 650, true, 0, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', jsonb_build_object('en', jsonb_build_object('name', 'Signature Doro Wat', 'description', 'A rich, slow-simmered house classic with injera.'))),
      (v_business.id, v_second_category_id, 590, false, 1, 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85', jsonb_build_object('en', jsonb_build_object('name', 'Herb Butter Pasta', 'description', 'Silky pasta, garden herbs and parmesan.')));

    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Coffee & Drinks', 'Coffee', 2) returning id into v_third_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, image_url, translations)
    values
      (v_business.id, v_third_category_id, 180, true, 0, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85', jsonb_build_object('en', jsonb_build_object('name', 'House Macchiato', 'description', 'Ethiopian coffee with a silky, golden finish.'))),
      (v_business.id, v_third_category_id, 220, false, 1, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85', jsonb_build_object('en', jsonb_build_object('name', 'Cinnamon Cake', 'description', 'Soft house cake served with a warm spice glaze.')));

  elsif v_category_slug = 'salon' then
    update public.businesses
    set description = 'A polished beauty studio for confident, effortless style.',
        about_content = format('%s is a modern studio for considered cuts, colour and self-care. Replace this demo copy with your story, team and signature approach.', p_name),
        phone = '+251 911 234 567', email = 'hello@example.com', address = 'Bole, Addis Ababa, Ethiopia',
        gallery_urls = array['https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=1200&q=85']
    where id = v_business.id;
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Signature Services', 'Scissors', 0) returning id into v_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_category_id, 850, true, 0, jsonb_build_object('en', jsonb_build_object('name', 'Signature Cut & Finish', 'description', 'A tailored cut with wash, styling and finishing details.'))),
      (v_business.id, v_category_id, 1400, true, 1, jsonb_build_object('en', jsonb_build_object('name', 'Glow Colour Session', 'description', 'Personalised colour consultation and luminous finish.')));
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Wellness Treatments', 'Heart', 1) returning id into v_second_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_second_category_id, 900, false, 0, jsonb_build_object('en', jsonb_build_object('name', 'Deep Care Ritual', 'description', 'A restorative treatment designed for a slower, softer hour.'))),
      (v_business.id, v_second_category_id, 500, false, 1, jsonb_build_object('en', jsonb_build_object('name', 'Express Styling', 'description', 'Polished styling for an event, meeting or night out.')));

  elsif v_category_slug = 'retail' then
    update public.businesses
    set description = 'A curated shop for beautiful, useful pieces with a story.',
        about_content = format('Discover the point of view behind %s. This demo gives you a complete starting collection; replace products, prices and story from your dashboard.', p_name),
        phone = '+251 911 234 567', email = 'hello@example.com', address = 'Bole, Addis Ababa, Ethiopia',
        gallery_urls = array['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85']
    where id = v_business.id;
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Featured Collection', 'Sparkles', 0) returning id into v_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_category_id, 1250, true, 0, jsonb_build_object('en', jsonb_build_object('name', 'Everyday Linen Set', 'description', 'Natural texture and easy form for daily rituals.'))),
      (v_business.id, v_category_id, 980, true, 1, jsonb_build_object('en', jsonb_build_object('name', 'Handmade Carryall', 'description', 'A durable, considered companion for work and weekends.')));
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'New Arrivals', 'Plus', 1) returning id into v_second_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_second_category_id, 650, false, 0, jsonb_build_object('en', jsonb_build_object('name', 'Studio Ceramic', 'description', 'A small-batch piece made for everyday use.'))),
      (v_business.id, v_second_category_id, 450, false, 1, jsonb_build_object('en', jsonb_build_object('name', 'Scented Candle', 'description', 'Soft woods, amber and a quiet evening atmosphere.')));

  elsif v_category_slug = 'hotel' then
    update public.businesses
    set description = 'A considered stay with generous hospitality and room to breathe.',
        about_content = format('Welcome to %s. Use this polished lodging demo as your starting point, then add your rooms, amenities, photos and local recommendations.', p_name),
        phone = '+251 911 234 567', email = 'hello@example.com', address = 'Bole, Addis Ababa, Ethiopia',
        gallery_urls = array['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=85']
    where id = v_business.id;
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Rooms & Suites', 'BedDouble', 0) returning id into v_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_category_id, 4200, true, 0, jsonb_build_object('en', jsonb_build_object('name', 'Garden King Room', 'description', 'A calm room with breakfast, high-speed Wi-Fi and generous morning light.'))),
      (v_business.id, v_category_id, 6800, true, 1, jsonb_build_object('en', jsonb_build_object('name', 'Signature Suite', 'description', 'A spacious suite for longer stays and special occasions.')));
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Experiences', 'Compass', 1) returning id into v_second_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_second_category_id, 750, false, 0, jsonb_build_object('en', jsonb_build_object('name', 'City Welcome Tour', 'description', 'A thoughtful introduction to the neighbourhood with a local host.'))),
      (v_business.id, v_second_category_id, 950, false, 1, jsonb_build_object('en', jsonb_build_object('name', 'Slow Breakfast', 'description', 'A relaxed house breakfast prepared around your morning.')));

  else
    update public.businesses
    set description = 'A polished online home for your business, products and services.',
        about_content = format('Tell the story of %s here. This editable demo gives you a complete starting point for your business.', p_name),
        phone = '+251 911 234 567', email = 'hello@example.com', address = 'Bole, Addis Ababa, Ethiopia',
        gallery_urls = array['https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=85']
    where id = v_business.id;
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Featured', 'Sparkles', 0) returning id into v_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_category_id, 500, true, 0, jsonb_build_object('en', jsonb_build_object('name', 'Signature Offering', 'description', 'Your most important product or service goes here.'))),
      (v_business.id, v_category_id, 750, false, 1, jsonb_build_object('en', jsonb_build_object('name', 'Customer Favourite', 'description', 'A second polished example for your first collection.')));
    insert into public.categories (business_id, name, icon, sort_order)
    values (v_business.id, 'Services', 'BriefcaseBusiness', 1) returning id into v_second_category_id;
    insert into public.items (business_id, category_id, price, is_featured, sort_order, translations)
    values
      (v_business.id, v_second_category_id, 900, false, 0, jsonb_build_object('en', jsonb_build_object('name', 'Personal Consultation', 'description', 'A clear first step for customers who need your expertise.'))),
      (v_business.id, v_second_category_id, 1200, false, 1, jsonb_build_object('en', jsonb_build_object('name', 'Complete Package', 'description', 'A fuller option you can rename and tailor from Catalog.')));
  end if;

  select * into v_business from public.businesses where id = v_business.id;
  return v_business;
end;
$$;

revoke execute on function public.create_business_with_trial(text, text, uuid) from public;
grant execute on function public.create_business_with_trial(text, text, uuid) to authenticated;
