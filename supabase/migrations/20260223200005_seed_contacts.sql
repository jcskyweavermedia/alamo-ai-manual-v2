-- =============================================================================
-- MIGRATION: seed_contacts
-- Seeds 15 demo contacts across 6 categories for Alamo Prime
-- All contacts marked is_demo_data = true with DEMO prefix and (555) phones
-- FTS trigger auto-populates search_vector on insert
-- Phase 1 of Form Builder System
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Look up the Alamo Prime group dynamically
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found — cannot seed contacts';
  END IF;

  INSERT INTO public.contacts (
    group_id, category, subcategory, name, contact_person,
    phone, phone_alt, email, address, notes,
    is_priority, is_demo_data, sort_order, status
  ) VALUES

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORY: emergency (3 contacts)
  -- Priority contacts first (fire dept, poison control), then non-priority
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 1. Fire Department (priority)
  (
    v_group_id, 'emergency', 'fire_dept',
    'DEMO - Sample Fire Department',
    'Dispatch (Demo)',
    '(555) 555-0101', '911',
    NULL,
    '123 Main St, San Antonio, TX 78205',
    'Call 911 for all fire emergencies. Non-emergency line for inspections and fire code questions. (Demo contact — replace with your actual data)',
    true, true, 1, 'active'
  ),

  -- 2. Poison Control (priority — real national number kept)
  (
    v_group_id, 'emergency', 'poison_control',
    'DEMO - Poison Control Center',
    'Hotline Operator (Demo)',
    '(800) 222-1222', NULL,
    NULL,
    '123 Main St, San Antonio, TX 78205',
    'National 24/7 poison emergency hotline. Free and confidential. Call immediately if anyone ingests a chemical, cleaning product, or unknown substance. (Demo contact — replace with your actual data)',
    true, true, 2, 'active'
  ),

  -- 3. Police Non-Emergency
  (
    v_group_id, 'emergency', 'police',
    'DEMO - Sample Police Non-Emergency',
    'Dispatch (Demo)',
    '(555) 555-0102', '911',
    NULL,
    '123 Main St, San Antonio, TX 78205',
    'Non-emergency line for filing reports, noise complaints, or requesting an officer. Call 911 for emergencies. (Demo contact — replace with your actual data)',
    false, true, 3, 'active'
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORY: medical (3 contacts, all priority)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 4. Nearest Hospital (priority)
  (
    v_group_id, 'medical', 'hospital',
    'DEMO - Sample Hospital',
    'Dr. Jane Doe (Demo)',
    '(555) 555-0201', NULL,
    'er@example.com',
    '123 Main St, San Antonio, TX 78205',
    '24/7 Emergency Room. Closest hospital to the restaurant. Call ahead if transporting an injured employee so ER can prepare. (Demo contact — replace with your actual data)',
    true, true, 1, 'active'
  ),

  -- 5. Urgent Care
  (
    v_group_id, 'medical', 'urgent_care',
    'DEMO - Sample Urgent Care',
    'Front Desk (Demo)',
    '(555) 555-0202', NULL,
    'info@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Walk-in urgent care for non-life-threatening injuries. Open Mon-Fri 8am-8pm, Sat-Sun 9am-5pm. Faster than the ER for minor cuts, burns, and sprains. (Demo contact — replace with your actual data)',
    true, true, 2, 'active'
  ),

  -- 6. Workers Comp Insurance
  (
    v_group_id, 'medical', 'workers_comp',
    'DEMO - Sample Workers Comp Insurance',
    'Claims Dept (Demo)',
    '(555) 555-0203', NULL,
    'claims@example.com',
    '123 Main St, San Antonio, TX 78205',
    'File a workers compensation claim within 24 hours of any workplace injury. Have the employee name, date of injury, and incident description ready. (Demo contact — replace with your actual data)',
    true, true, 3, 'active'
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORY: management (3 contacts)
  -- Priority contacts first (regional mgr, GM), then non-priority (HR)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 7. Regional Manager (priority)
  (
    v_group_id, 'management', 'regional_manager',
    'DEMO - Regional Manager',
    'Sarah Johnson (Demo)',
    '(555) 555-0301', NULL,
    'regional.manager@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Notify for ALL injuries, incidents, property damage, and employee terminations. Available 7am-10pm. Text first if after 8pm. (Demo contact — replace with your actual data)',
    true, true, 1, 'active'
  ),

  -- 8. General Manager (priority)
  (
    v_group_id, 'management', 'general_manager',
    'DEMO - General Manager',
    'Michael Torres (Demo)',
    '(555) 555-0302', NULL,
    'gm@example.com',
    '123 Main St, San Antonio, TX 78205',
    'On-site manager and first point of escalation. Notify immediately for guest complaints, employee issues, and equipment failures. (Demo contact — replace with your actual data)',
    true, true, 2, 'active'
  ),

  -- 9. HR Representative
  (
    v_group_id, 'management', 'hr',
    'DEMO - HR Representative',
    'Lisa Martinez (Demo)',
    '(555) 555-0303', NULL,
    'hr@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Contact for write-ups, terminations, benefits questions, harassment reports, and workers comp claims. Response within 1 business day. (Demo contact — replace with your actual data)',
    false, true, 3, 'active'
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORY: vendor (3 contacts)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 10. Meat Supplier
  (
    v_group_id, 'vendor', 'meat_supplier',
    'DEMO - Sample Meat Supplier',
    'Account Rep (Demo)',
    '(555) 555-0401', NULL,
    'orders@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Delivery Mon-Fri 6am. Order cutoff: previous day by 2pm. For emergency orders or short deliveries, call the account rep directly. (Demo contact — replace with your actual data)',
    false, true, 1, 'active'
  ),

  -- 11. Produce Supplier
  (
    v_group_id, 'vendor', 'produce_supplier',
    'DEMO - Sample Produce Supplier',
    'Account Rep (Demo)',
    '(555) 555-0402', NULL,
    'produce@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Delivery Mon/Wed/Fri 7am. Order cutoff: previous day by noon. Inspect all deliveries on arrival — reject wilted or damaged product immediately. (Demo contact — replace with your actual data)',
    false, true, 2, 'active'
  ),

  -- 12. Equipment Repair
  (
    v_group_id, 'vendor', 'equipment_repair',
    'DEMO - Sample Equipment Repair',
    'Service Dept (Demo)',
    '(555) 555-0403', NULL,
    'service@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Call for broken kitchen equipment, HVAC issues, refrigeration failures, or plumbing emergencies. Emergency service available 24/7 at extra cost. (Demo contact — replace with your actual data)',
    false, true, 3, 'active'
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORY: government (2 contacts)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 13. Health Department
  (
    v_group_id, 'government', 'health_dept',
    'DEMO - Sample Health Department',
    'Food Safety Division (Demo)',
    '(555) 555-0501', NULL,
    'health@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Health inspections, food safety complaints, and permit renewals. Keep current health permit posted in a visible location at all times. (Demo contact — replace with your actual data)',
    false, true, 1, 'active'
  ),

  -- 14. OSHA
  (
    v_group_id, 'government', 'osha',
    'DEMO - Sample OSHA Office',
    'Area Director (Demo)',
    '(555) 555-0502', '(555) 555-0503',
    'osha@example.com',
    '123 Main St, San Antonio, TX 78205',
    'Workplace safety complaints and injury reporting requirements. Fatalities must be reported within 8 hours; hospitalizations within 24 hours. (Demo contact — replace with your actual data)',
    false, true, 2, 'active'
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CATEGORY: insurance (1 contact)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 15. General Liability Insurance
  (
    v_group_id, 'insurance', 'general_liability',
    'DEMO - Sample General Liability Insurance',
    'Claims Agent (Demo)',
    '(555) 555-0601', NULL,
    'liability@example.com',
    '123 Main St, San Antonio, TX 78205',
    'File a claim for guest injuries, property damage, or slip-and-fall incidents. Document everything with photos and witness statements before calling. Policy number on file in the office. (Demo contact — replace with your actual data)',
    false, true, 1, 'active'
  );

END;
$$;

COMMIT;
