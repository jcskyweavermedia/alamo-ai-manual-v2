-- =============================================================================
-- MIGRATION: streamline_writeup_template
-- Simplifies the Employee Write-Up form:
--   - Removes 6 fields: employee_id, date_of_hire, supervisor_name,
--     prior_warnings, employee_explanation, improvement_timeline
--   - Replaces corrective_action with notes_plan_of_action
--   - Consolidates 5 sections → 3: Employee Info, Write-Up Details, Acknowledgment
--   - Adds width:"half" for 2-column layout on tablet+
--   - Re-numbers field order
--   - Bumps template_version
-- =============================================================================

UPDATE public.form_templates
SET fields = $JSONB$[
  {
    "key": "section_employee_info",
    "label": "Employee Information",
    "label_es": "Informacion del Empleado",
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
    "width": "half",
    "order": 2
  },
  {
    "key": "position",
    "label": "Position / Title",
    "label_es": "Puesto / Titulo",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Line Cook, Server",
    "ai_hint": "Extract the employee's job title or position",
    "width": "half",
    "order": 3
  },
  {
    "key": "department",
    "label": "Department",
    "label_es": "Departamento",
    "type": "select",
    "required": true,
    "options": ["FOH", "BOH", "Bar", "Management"],
    "ai_hint": "Determine the department based on the employee's role. Servers/hosts = FOH, cooks/prep = BOH, bartenders = Bar",
    "width": "half",
    "order": 4
  },
  {
    "key": "date_of_incident",
    "label": "Date of Incident",
    "label_es": "Fecha del Incidente",
    "type": "date",
    "required": true,
    "ai_hint": "Extract the date when the incident occurred. If 'today' is mentioned, use the current date.",
    "width": "half",
    "order": 5
  },
  {
    "key": "section_writeup_details",
    "label": "Write-Up Details",
    "label_es": "Detalles de la Amonestacion",
    "type": "header",
    "required": false,
    "order": 6
  },
  {
    "key": "violation_type",
    "label": "Type of Violation",
    "label_es": "Tipo de Violacion",
    "type": "select",
    "required": true,
    "options": ["Attendance", "Performance", "Conduct", "Policy Violation", "Safety", "Other"],
    "ai_hint": "Categorize: tardiness/no-show = Attendance, poor work quality = Performance, rude/insubordinate = Conduct, broke a rule = Policy Violation, unsafe behavior = Safety",
    "order": 7
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
    "order": 8
  },
  {
    "key": "description",
    "label": "Description of Incident",
    "label_es": "Descripcion del Incidente",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened, including date, time, and specific details",
    "ai_hint": "Write a factual, professional description of the incident — no opinions, just facts",
    "order": 9
  },
  {
    "key": "notes_plan_of_action",
    "label": "Notes / Plan of Action",
    "label_es": "Notas / Plan de Accion",
    "type": "textarea",
    "required": true,
    "placeholder": "What corrective action is expected? What needs to change?",
    "hint": "Include expectations, deadlines, and consequences if not corrected.",
    "ai_hint": "Suggest appropriate corrective action and expectations based on the severity level",
    "order": 10
  },
  {
    "key": "section_acknowledgment",
    "label": "Acknowledgment",
    "label_es": "Reconocimiento",
    "type": "header",
    "required": false,
    "order": 11
  },
  {
    "key": "supporting_docs",
    "label": "Supporting Documents",
    "label_es": "Documentos de Soporte",
    "type": "file",
    "required": false,
    "hint": "Upload photos or documents related to the incident",
    "order": 12
  },
  {
    "key": "employee_signature",
    "label": "Employee Signature",
    "label_es": "Firma del Empleado",
    "type": "signature",
    "required": false,
    "hint": "Employee signs to acknowledge receipt of this write-up",
    "order": 13
  },
  {
    "key": "employee_refused_to_sign",
    "label": "Employee Refused to Sign",
    "label_es": "Empleado Se Nego a Firmar",
    "type": "checkbox",
    "required": false,
    "options": ["Employee refused to sign"],
    "hint": "Check if the employee refused to sign this document",
    "width": "half",
    "order": 14
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "ai_hint": "Default to today's date",
    "width": "half",
    "order": 15
  },
  {
    "key": "manager_signature",
    "label": "Manager Signature",
    "label_es": "Firma del Gerente",
    "type": "signature",
    "required": true,
    "hint": "Manager on duty signature",
    "order": 16
  }
]$JSONB$::JSONB,
template_version = template_version + 1
WHERE slug = 'employee-write-up';
