-- =============================================================================
-- MIGRATION: seed_form_templates
-- Seeds 2 published form templates: Employee Write-Up & Employee Injury Report
-- Phase 1 of Form Builder System
-- =============================================================================

DO $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Look up Alamo Prime group dynamically
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEMPLATE 1: Employee Write-Up
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.form_templates (
    group_id,
    slug,
    title_en,
    title_es,
    description_en,
    description_es,
    icon,
    fields,
    instructions_en,
    instructions_es,
    ai_tools,
    status,
    sort_order
  ) VALUES (
    v_group_id,
    'employee-write-up',
    'Employee Write-Up',
    'Amonestación del Empleado',
    'Document employee performance issues, policy violations, or behavioral concerns.',
    'Documentar problemas de desempeño, violaciones de política o conducta del empleado.',
    'FileWarning',
    $JSONB$[
  {
    "key": "section_employee_info",
    "label": "Employee Information",
    "label_es": "Información del Empleado",
    "type": "header",
    "required": false,
    "order": 1
  },
  {
    "key": "employee_name",
    "label": "Employee Full Name",
    "label_es": "Nombre Completo del Empleado",
    "type": "text",
    "required": true,
    "placeholder": "e.g., John Smith",
    "hint": "Full legal name as it appears on their ID",
    "ai_hint": "Extract the employee's full name from the input",
    "section": "Employee Information",
    "section_es": "Información del Empleado",
    "order": 2
  },
  {
    "key": "employee_id",
    "label": "Employee ID",
    "label_es": "ID del Empleado",
    "type": "text",
    "required": false,
    "placeholder": "e.g., EMP-1234",
    "hint": "Badge number or employee ID if available",
    "section": "Employee Information",
    "section_es": "Información del Empleado",
    "order": 3
  },
  {
    "key": "position",
    "label": "Position / Title",
    "label_es": "Puesto / Título",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Line Cook, Server",
    "ai_hint": "Extract the employee's job title or position",
    "section": "Employee Information",
    "section_es": "Información del Empleado",
    "order": 4
  },
  {
    "key": "department",
    "label": "Department",
    "label_es": "Departamento",
    "type": "select",
    "required": true,
    "options": ["FOH", "BOH", "Bar", "Management"],
    "ai_hint": "Determine the department based on the employee's role. Servers/hosts = FOH, cooks/prep = BOH, bartenders = Bar",
    "section": "Employee Information",
    "section_es": "Información del Empleado",
    "order": 5
  },
  {
    "key": "date_of_hire",
    "label": "Date of Hire",
    "label_es": "Fecha de Contratación",
    "type": "date",
    "required": false,
    "ai_hint": "Extract the hire date if mentioned",
    "section": "Employee Information",
    "section_es": "Información del Empleado",
    "order": 6
  },
  {
    "key": "supervisor_name",
    "label": "Supervisor Name",
    "label_es": "Nombre del Supervisor",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Maria Garcia",
    "ai_hint": "Extract the supervisor or manager name if mentioned",
    "section": "Employee Information",
    "section_es": "Información del Empleado",
    "order": 7
  },
  {
    "key": "section_writeup_details",
    "label": "Write-Up Details",
    "label_es": "Detalles de la Amonestación",
    "type": "header",
    "required": false,
    "order": 8
  },
  {
    "key": "date_of_incident",
    "label": "Date of Incident",
    "label_es": "Fecha del Incidente",
    "type": "date",
    "required": true,
    "ai_hint": "Extract the date when the incident occurred. If 'today' is mentioned, use the current date.",
    "section": "Write-Up Details",
    "section_es": "Detalles de la Amonestación",
    "order": 9
  },
  {
    "key": "violation_type",
    "label": "Type of Violation",
    "label_es": "Tipo de Violación",
    "type": "select",
    "required": true,
    "options": ["Attendance", "Performance", "Conduct", "Policy Violation", "Safety", "Other"],
    "ai_hint": "Categorize: tardiness/no-show = Attendance, poor work quality = Performance, rude/insubordinate = Conduct, broke a rule = Policy Violation, unsafe behavior = Safety",
    "section": "Write-Up Details",
    "section_es": "Detalles de la Amonestación",
    "order": 10
  },
  {
    "key": "severity",
    "label": "Severity",
    "label_es": "Severidad",
    "type": "radio",
    "required": true,
    "options": ["Verbal Warning", "Written Warning", "Final Warning", "Suspension", "Termination"],
    "hint": "Verbal warnings should still be documented in writing.",
    "ai_hint": "Assess severity: first offense = Verbal or Written. Repeated = Final Warning. Serious safety/conduct = Suspension or Termination.",
    "section": "Write-Up Details",
    "section_es": "Detalles de la Amonestación",
    "order": 11
  },
  {
    "key": "prior_warnings",
    "label": "Number of Prior Warnings",
    "label_es": "Número de Advertencias Previas",
    "type": "number",
    "required": false,
    "hint": "Include both verbal and written warnings",
    "ai_hint": "Extract the count of previous warnings if mentioned",
    "section": "Write-Up Details",
    "section_es": "Detalles de la Amonestación",
    "order": 12
  },
  {
    "key": "section_incident",
    "label": "Incident Description",
    "label_es": "Descripción del Incidente",
    "type": "header",
    "required": false,
    "order": 13
  },
  {
    "key": "description",
    "label": "Description of Incident",
    "label_es": "Descripción del Incidente",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened, including date, time, and specific details",
    "ai_hint": "Write a factual, professional description — no opinions, just facts",
    "section": "Incident Description",
    "section_es": "Descripción del Incidente",
    "order": 14
  },
  {
    "key": "employee_explanation",
    "label": "Employee's Explanation",
    "label_es": "Explicación del Empleado",
    "type": "textarea",
    "required": false,
    "placeholder": "Employee's response or explanation of the incident",
    "ai_hint": "If the employee's response or explanation is mentioned, capture it here",
    "section": "Incident Description",
    "section_es": "Descripción del Incidente",
    "order": 15
  },
  {
    "key": "corrective_action",
    "label": "Corrective Action Required",
    "label_es": "Acción Correctiva Requerida",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe the required corrective action",
    "ai_hint": "Suggest appropriate corrective action based on the severity level",
    "section": "Incident Description",
    "section_es": "Descripción del Incidente",
    "order": 16
  },
  {
    "key": "improvement_timeline",
    "label": "Timeline for Improvement",
    "label_es": "Plazo para Mejora",
    "type": "text",
    "required": false,
    "placeholder": "e.g., 30 days, by next review period",
    "ai_hint": "Suggest a reasonable timeline based on the severity",
    "section": "Incident Description",
    "section_es": "Descripción del Incidente",
    "order": 17
  },
  {
    "key": "section_attachments",
    "label": "Attachments",
    "label_es": "Adjuntos",
    "type": "header",
    "required": false,
    "order": 18
  },
  {
    "key": "supporting_docs",
    "label": "Supporting Documents",
    "label_es": "Documentos de Soporte",
    "type": "file",
    "required": false,
    "hint": "Upload photos or documents related to the incident",
    "section": "Attachments",
    "section_es": "Adjuntos",
    "order": 19
  },
  {
    "key": "section_acknowledgment",
    "label": "Acknowledgment",
    "label_es": "Reconocimiento",
    "type": "header",
    "required": false,
    "order": 20
  },
  {
    "key": "employee_signature",
    "label": "Employee Signature",
    "label_es": "Firma del Empleado",
    "type": "signature",
    "required": false,
    "hint": "Employee signs to acknowledge receipt of this write-up",
    "section": "Acknowledgment",
    "section_es": "Reconocimiento",
    "order": 21
  },
  {
    "key": "employee_refused_to_sign",
    "label": "Employee Refused to Sign",
    "label_es": "Empleado Se Negó a Firmar",
    "type": "checkbox",
    "required": false,
    "options": ["Employee refused to sign"],
    "hint": "Check if the employee refused to sign this document",
    "condition": null,
    "section": "Acknowledgment",
    "section_es": "Reconocimiento",
    "order": 22
  },
  {
    "key": "manager_signature",
    "label": "Manager Signature",
    "label_es": "Firma del Gerente",
    "type": "signature",
    "required": true,
    "hint": "Manager on duty signature",
    "section": "Acknowledgment",
    "section_es": "Reconocimiento",
    "order": 23
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "ai_hint": "Default to today's date",
    "section": "Acknowledgment",
    "section_es": "Reconocimiento",
    "order": 24
  }
]$JSONB$::JSONB,
    E'1. Identify the employee and their role from the user''s description.\n2. Determine the type and severity of the violation.\n3. Write a factual, professional description of the incident — no opinions, just facts.\n4. Suggest appropriate corrective action based on the severity.\n5. If the user mentions prior incidents, note the count of previous warnings.\n6. Use the manual search to reference relevant company policies if applicable.',
    E'1. Identificar al empleado y su puesto a partir de la descripción del usuario.\n2. Determinar el tipo y la severidad de la violación.\n3. Escribir una descripción factual y profesional del incidente — sin opiniones, solo hechos.\n4. Sugerir la acción correctiva apropiada según la severidad.\n5. Si el usuario menciona incidentes previos, anotar la cantidad de advertencias anteriores.\n6. Usar la búsqueda del manual para hacer referencia a las políticas relevantes de la empresa si aplica.',
    '{search_manual}',
    'published',
    1
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEMPLATE 2: Employee Injury Report
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.form_templates (
    group_id,
    slug,
    title_en,
    title_es,
    description_en,
    description_es,
    icon,
    fields,
    instructions_en,
    instructions_es,
    ai_tools,
    status,
    sort_order
  ) VALUES (
    v_group_id,
    'employee-injury-report',
    'Employee Injury Report',
    'Reporte de Lesión del Empleado',
    'Document workplace injuries, ensure proper medical response, and maintain compliance records.',
    'Documentar lesiones laborales, asegurar respuesta médica adecuada y mantener registros de cumplimiento.',
    'HeartPulse',
    $JSONB$[
  {
    "key": "section_injured_employee",
    "label": "Injured Employee",
    "label_es": "Empleado Lesionado",
    "type": "header",
    "required": false,
    "order": 1
  },
  {
    "key": "employee_name",
    "label": "Employee Full Name",
    "label_es": "Nombre Completo del Empleado",
    "type": "text",
    "required": true,
    "placeholder": "Enter injured employee's full name",
    "ai_hint": "Extract the injured employee's full name",
    "section": "Injured Employee",
    "section_es": "Empleado Lesionado",
    "order": 2
  },
  {
    "key": "employee_id",
    "label": "Employee ID",
    "label_es": "ID del Empleado",
    "type": "text",
    "required": false,
    "placeholder": "e.g., EMP-1234",
    "hint": "Badge number or employee ID if available",
    "section": "Injured Employee",
    "section_es": "Empleado Lesionado",
    "order": 3
  },
  {
    "key": "position",
    "label": "Position / Title",
    "label_es": "Puesto / Título",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Line Cook, Dishwasher, Server",
    "ai_hint": "Extract the employee's job title or position",
    "section": "Injured Employee",
    "section_es": "Empleado Lesionado",
    "order": 4
  },
  {
    "key": "department",
    "label": "Department",
    "label_es": "Departamento",
    "type": "select",
    "required": true,
    "options": ["FOH", "BOH", "Bar", "Management"],
    "ai_hint": "Determine department from role context",
    "section": "Injured Employee",
    "section_es": "Empleado Lesionado",
    "order": 5
  },
  {
    "key": "date_of_hire",
    "label": "Date of Hire",
    "label_es": "Fecha de Contratación",
    "type": "date",
    "required": false,
    "section": "Injured Employee",
    "section_es": "Empleado Lesionado",
    "order": 6
  },
  {
    "key": "section_incident_details",
    "label": "Incident Details",
    "label_es": "Detalles del Incidente",
    "type": "header",
    "required": false,
    "order": 7
  },
  {
    "key": "date_of_injury",
    "label": "Date of Injury",
    "label_es": "Fecha de la Lesión",
    "type": "date",
    "required": true,
    "ai_hint": "Extract the date of injury. If 'today' is mentioned, use the current date.",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 8
  },
  {
    "key": "time_of_injury",
    "label": "Time of Injury",
    "label_es": "Hora de la Lesión",
    "type": "time",
    "required": true,
    "ai_hint": "Extract the time. Convert to 24h format (e.g., '3pm' = '15:00').",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 9
  },
  {
    "key": "location",
    "label": "Location in Restaurant",
    "label_es": "Ubicación en el Restaurante",
    "type": "select",
    "required": true,
    "options": ["Kitchen", "Dining Room", "Bar", "Patio", "Parking Lot", "Storage/Walk-in", "Office", "Restroom", "Other"],
    "ai_hint": "Determine the location where the injury occurred from context",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 10
  },
  {
    "key": "description",
    "label": "Description of Injury",
    "label_es": "Descripción de la Lesión",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened in detail...",
    "ai_hint": "Document exactly what happened — when, where, how. Be specific and factual.",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 11
  },
  {
    "key": "body_parts",
    "label": "Body Part(s) Affected",
    "label_es": "Parte(s) del Cuerpo Afectada(s)",
    "type": "checkbox",
    "required": true,
    "options": ["Head", "Neck", "Back", "Shoulder", "Arm", "Hand", "Finger", "Leg", "Knee", "Foot", "Torso", "Other"],
    "ai_hint": "Identify all body parts affected from the injury description",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 12
  },
  {
    "key": "injury_type",
    "label": "Type of Injury",
    "label_es": "Tipo de Lesión",
    "type": "select",
    "required": true,
    "options": ["Cut/Laceration", "Burn", "Slip/Fall", "Strain/Sprain", "Fracture", "Chemical Exposure", "Other"],
    "ai_hint": "Classify the type of injury from the description",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 13
  },
  {
    "key": "injury_photos",
    "label": "Photos of Injury / Scene",
    "label_es": "Fotos de la Lesión / Escena",
    "type": "image",
    "required": false,
    "hint": "Take photos of the injury and scene before anything changes",
    "section": "Incident Details",
    "section_es": "Detalles del Incidente",
    "order": 14
  },
  {
    "key": "section_immediate_response",
    "label": "Immediate Response",
    "label_es": "Respuesta Inmediata",
    "type": "header",
    "required": false,
    "order": 15
  },
  {
    "key": "first_aid",
    "label": "First Aid Administered",
    "label_es": "Primeros Auxilios Administrados",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any first aid administered",
    "ai_hint": "Document any first aid or immediate treatment described",
    "section": "Immediate Response",
    "section_es": "Respuesta Inmediata",
    "order": 16
  },
  {
    "key": "called_911",
    "label": "911 Called",
    "label_es": "Se Llamó al 911",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if 911 was called from the description",
    "section": "Immediate Response",
    "section_es": "Respuesta Inmediata",
    "order": 17
  },
  {
    "key": "transported_to_hospital",
    "label": "Transported to Hospital",
    "label_es": "Transportado al Hospital",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if the employee was taken to a hospital",
    "section": "Immediate Response",
    "section_es": "Respuesta Inmediata",
    "order": 18
  },
  {
    "key": "hospital_contact",
    "label": "Hospital / Medical Facility",
    "label_es": "Hospital / Centro Médico",
    "type": "contact_lookup",
    "required": false,
    "hint": "Search for a hospital or medical facility",
    "ai_hint": "Use search_contacts with category 'medical' to find the nearest hospital. Pre-fill this field.",
    "condition": {
      "field": "transported_to_hospital",
      "operator": "eq",
      "value": "Yes"
    },
    "validation": {
      "contact_category": "medical"
    },
    "section": "Immediate Response",
    "section_es": "Respuesta Inmediata",
    "order": 19
  },
  {
    "key": "regional_notified",
    "label": "Regional Manager Notified",
    "label_es": "Gerente Regional Notificado",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if the regional manager was notified",
    "section": "Immediate Response",
    "section_es": "Respuesta Inmediata",
    "order": 20
  },
  {
    "key": "regional_contact",
    "label": "Regional Manager Contact",
    "label_es": "Contacto del Gerente Regional",
    "type": "contact_lookup",
    "required": false,
    "hint": "Search for the regional manager",
    "ai_hint": "Use search_contacts with category 'management' to find the regional manager. Pre-fill this field.",
    "condition": {
      "field": "regional_notified",
      "operator": "eq",
      "value": "Yes"
    },
    "validation": {
      "contact_category": "management"
    },
    "section": "Immediate Response",
    "section_es": "Respuesta Inmediata",
    "order": 21
  },
  {
    "key": "section_witnesses",
    "label": "Witnesses",
    "label_es": "Testigos",
    "type": "header",
    "required": false,
    "order": 22
  },
  {
    "key": "witnesses_present",
    "label": "Witnesses Present",
    "label_es": "Testigos Presentes",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if any witnesses were present from the description",
    "section": "Witnesses",
    "section_es": "Testigos",
    "order": 23
  },
  {
    "key": "witness_statements",
    "label": "Witness Names & Statements",
    "label_es": "Nombres y Declaraciones de Testigos",
    "type": "textarea",
    "required": false,
    "placeholder": "List witness names and their statements",
    "ai_hint": "Extract any witness names and statements mentioned",
    "condition": {
      "field": "witnesses_present",
      "operator": "eq",
      "value": "Yes"
    },
    "section": "Witnesses",
    "section_es": "Testigos",
    "order": 24
  },
  {
    "key": "section_root_cause",
    "label": "Root Cause",
    "label_es": "Causa Raíz",
    "type": "header",
    "required": false,
    "order": 25
  },
  {
    "key": "cause",
    "label": "What Caused the Injury",
    "label_es": "Qué Causó la Lesión",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe the root cause...",
    "ai_hint": "Assess what led to the injury",
    "section": "Root Cause",
    "section_es": "Causa Raíz",
    "order": 26
  },
  {
    "key": "preventable",
    "label": "Could It Have Been Prevented",
    "label_es": "Se Pudo Haber Prevenido",
    "type": "radio",
    "required": false,
    "options": ["Yes", "No", "Unsure"],
    "hint": "Be honest — this is for prevention, not blame.",
    "ai_hint": "Assess based on the root cause whether this was preventable",
    "section": "Root Cause",
    "section_es": "Causa Raíz",
    "order": 27
  },
  {
    "key": "corrective_action",
    "label": "Corrective Action Taken",
    "label_es": "Acción Correctiva Tomada",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any corrective action taken or recommended",
    "ai_hint": "Document any corrective actions mentioned, or suggest appropriate ones based on the root cause",
    "section": "Root Cause",
    "section_es": "Causa Raíz",
    "order": 28
  },
  {
    "key": "section_attachments",
    "label": "Attachments",
    "label_es": "Adjuntos",
    "type": "header",
    "required": false,
    "order": 29
  },
  {
    "key": "supporting_docs",
    "label": "Supporting Documents",
    "label_es": "Documentos de Soporte",
    "type": "file",
    "required": false,
    "hint": "Upload any additional supporting documents",
    "section": "Attachments",
    "section_es": "Adjuntos",
    "order": 30
  },
  {
    "key": "section_signatures",
    "label": "Signatures",
    "label_es": "Firmas",
    "type": "header",
    "required": false,
    "order": 31
  },
  {
    "key": "employee_signature",
    "label": "Injured Employee Signature",
    "label_es": "Firma del Empleado Lesionado",
    "type": "signature",
    "required": false,
    "hint": "If the employee is able to sign",
    "section": "Signatures",
    "section_es": "Firmas",
    "order": 32
  },
  {
    "key": "manager_signature",
    "label": "Manager on Duty Signature",
    "label_es": "Firma del Gerente en Turno",
    "type": "signature",
    "required": true,
    "hint": "Manager on duty signature",
    "section": "Signatures",
    "section_es": "Firmas",
    "order": 33
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "ai_hint": "Default to today's date",
    "section": "Signatures",
    "section_es": "Firmas",
    "order": 34
  }
]$JSONB$::JSONB,
    E'1. Record the injured employee''s information (name, position, department).\n2. Document exactly what happened — when, where, how. Be specific and factual.\n3. Identify the type of injury and body parts affected from the description.\n4. CRITICAL — Use the "Search Contacts" tool to look up:\n   - The nearest hospital or urgent care facility (category: "medical")\n   - The regional manager''s contact information (category: "management")\n   - Pre-fill the Hospital and Regional Manager fields with this data.\n5. Note any first aid or immediate actions taken.\n6. Record witness information if anyone saw what happened.\n7. Assess root cause — what led to the injury and if it could be prevented.\n8. Use "Search Manual" to reference the emergency procedures section for compliance.',
    E'1. Registrar la información del empleado lesionado (nombre, puesto, departamento).\n2. Documentar exactamente qué sucedió — cuándo, dónde, cómo. Ser específico y factual.\n3. Identificar el tipo de lesión y las partes del cuerpo afectadas a partir de la descripción.\n4. CRÍTICO — Usar la herramienta "Buscar Contactos" para buscar:\n   - El hospital o centro de urgencias más cercano (categoría: "medical")\n   - La información de contacto del gerente regional (categoría: "management")\n   - Pre-llenar los campos de Hospital y Gerente Regional con esta información.\n5. Anotar cualquier primeros auxilios o acciones inmediatas tomadas.\n6. Registrar información de testigos si alguien vio lo que pasó.\n7. Evaluar la causa raíz — qué llevó a la lesión y si se pudo haber prevenido.\n8. Usar "Buscar Manual" para hacer referencia a la sección de procedimientos de emergencia para cumplimiento.',
    '{search_contacts,search_manual}',
    'published',
    2
  );

END $$;
