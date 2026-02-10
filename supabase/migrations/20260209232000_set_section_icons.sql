-- ============================================
-- SET ICONS for all manual_sections
-- Lucide icon names used by ManualOutline component
-- ============================================

BEGIN;

-- Top-level content sections
UPDATE manual_sections SET icon = 'Sparkles'       WHERE slug = 'welcome-philosophy';
UPDATE manual_sections SET icon = 'Building2'      WHERE slug = 'company-overview';
UPDATE manual_sections SET icon = 'Heart'          WHERE slug = 'core-values';
UPDATE manual_sections SET icon = 'Star'           WHERE slug = 'service-excellence';
UPDATE manual_sections SET icon = 'Clock'          WHERE slug = 'hours-operations';
UPDATE manual_sections SET icon = 'Palette'        WHERE slug = 'brand-standards';

-- Category folders
UPDATE manual_sections SET icon = 'Users'          WHERE slug = 'team-roles';
UPDATE manual_sections SET icon = 'ClipboardCheck' WHERE slug = 'operational-procedures';
UPDATE manual_sections SET icon = 'HandHeart'      WHERE slug = 'guest-services';
UPDATE manual_sections SET icon = 'BookOpen'       WHERE slug = 'appendix';

-- Team Roles children
UPDATE manual_sections SET icon = 'Users'          WHERE slug = 'team-roles-overview';
UPDATE manual_sections SET icon = 'UserCheck'      WHERE slug = 'host-essentials';
UPDATE manual_sections SET icon = 'ConciergeBell'  WHERE slug = 'server-standards';
UPDATE manual_sections SET icon = 'ClipboardList'  WHERE slug = 'bus-person-procedures';
UPDATE manual_sections SET icon = 'Briefcase'      WHERE slug = 'management-roles';
UPDATE manual_sections SET icon = 'ChefHat'        WHERE slug = 'line-cook-standards';
UPDATE manual_sections SET icon = 'Utensils'       WHERE slug = 'prep-cook-procedures';
UPDATE manual_sections SET icon = 'Waves'          WHERE slug = 'dishwasher-operations';
UPDATE manual_sections SET icon = 'Wine'           WHERE slug = 'bartender-standards';
UPDATE manual_sections SET icon = 'Shield'         WHERE slug = 'security-host-support';

-- Operational Procedures children
UPDATE manual_sections SET icon = 'ClipboardCheck' WHERE slug = 'operational-procedures-overview';
UPDATE manual_sections SET icon = 'Sunrise'        WHERE slug = 'opening-duties';
UPDATE manual_sections SET icon = 'Activity'       WHERE slug = 'ongoing-operations';
UPDATE manual_sections SET icon = 'Moon'           WHERE slug = 'closing-protocols';
UPDATE manual_sections SET icon = 'Leaf'           WHERE slug = 'environment-standards';

-- Guest Services children
UPDATE manual_sections SET icon = 'HandHeart'      WHERE slug = 'guest-services-overview';
UPDATE manual_sections SET icon = 'HeartHandshake' WHERE slug = 'guest-recovery';
UPDATE manual_sections SET icon = 'Phone'          WHERE slug = 'telephone-etiquette';
UPDATE manual_sections SET icon = 'CalendarCheck'  WHERE slug = 'reservation-management';

-- Appendix children
UPDATE manual_sections SET icon = 'BookOpen'       WHERE slug = 'appendix-overview';
UPDATE manual_sections SET icon = 'HelpCircle'     WHERE slug = 'frequently-asked';
UPDATE manual_sections SET icon = 'BookMarked'     WHERE slug = 'terminology';
UPDATE manual_sections SET icon = 'CheckSquare'    WHERE slug = 'checklists';
UPDATE manual_sections SET icon = 'Contact'        WHERE slug = 'contact-info';

COMMIT;
