-- =============================================================================
-- MIGRATION: streamline_injury_report
-- Removes department, employee_id, date_of_hire.
-- Adds width:"half" to fields that pair well in 2-column layout.
-- Merges Witnesses into Immediate Response section.
-- Merges Attachments into Signatures section → "Documentation & Signatures".
-- Result: 7 sections → 5 sections, 34 fields → 29 fields
-- =============================================================================

UPDATE public.form_templates
SET fields = $JSONB$[
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
    "width": "half",
    "order": 2
  },
  {
    "key": "position",
    "label": "Position / Title",
    "label_es": "Puesto / Titulo",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Line Cook, Dishwasher, Server",
    "ai_hint": "Extract the employee's job title or position",
    "width": "half",
    "order": 3
  },
  {
    "key": "section_incident_details",
    "label": "Incident Details",
    "label_es": "Detalles del Incidente",
    "type": "header",
    "required": false,
    "order": 4
  },
  {
    "key": "date_of_injury",
    "label": "Date of Injury",
    "label_es": "Fecha de la Lesion",
    "type": "date",
    "required": true,
    "ai_hint": "Extract the date of injury. If 'today' is mentioned, use the current date.",
    "width": "half",
    "order": 5
  },
  {
    "key": "time_of_injury",
    "label": "Time of Injury",
    "label_es": "Hora de la Lesion",
    "type": "time",
    "required": true,
    "ai_hint": "Extract the time. Convert to 24h format (e.g., '3pm' = '15:00').",
    "width": "half",
    "order": 6
  },
  {
    "key": "location",
    "label": "Location in Restaurant",
    "label_es": "Ubicacion en el Restaurante",
    "type": "select",
    "required": true,
    "options": ["Kitchen", "Dining Room", "Bar", "Patio", "Parking Lot", "Storage/Walk-in", "Office", "Restroom", "Other"],
    "ai_hint": "Determine the location where the injury occurred from context",
    "width": "half",
    "order": 7
  },
  {
    "key": "injury_type",
    "label": "Type of Injury",
    "label_es": "Tipo de Lesion",
    "type": "select",
    "required": true,
    "options": ["Cut/Laceration", "Burn", "Slip/Fall", "Strain/Sprain", "Fracture", "Chemical Exposure", "Other"],
    "ai_hint": "Classify the type of injury from the description",
    "width": "half",
    "order": 8
  },
  {
    "key": "description",
    "label": "Description of Injury",
    "label_es": "Descripcion de la Lesion",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened in detail...",
    "ai_hint": "Document exactly what happened — when, where, how. Be specific and factual.",
    "order": 9
  },
  {
    "key": "body_parts",
    "label": "Body Part(s) Affected",
    "label_es": "Parte(s) del Cuerpo Afectada(s)",
    "type": "checkbox",
    "required": true,
    "options": ["Head", "Neck", "Back", "Shoulder", "Arm", "Hand", "Finger", "Leg", "Knee", "Foot", "Torso", "Other"],
    "ai_hint": "Identify all body parts affected from the injury description",
    "order": 10
  },
  {
    "key": "injury_photos",
    "label": "Photos of Injury / Scene",
    "label_es": "Fotos de la Lesion / Escena",
    "type": "image",
    "required": false,
    "hint": "Take photos of the injury and scene before anything changes",
    "order": 11
  },
  {
    "key": "section_immediate_response",
    "label": "Immediate Response",
    "label_es": "Respuesta Inmediata",
    "type": "header",
    "required": false,
    "order": 12
  },
  {
    "key": "first_aid",
    "label": "First Aid Administered",
    "label_es": "Primeros Auxilios Administrados",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any first aid administered",
    "ai_hint": "Document any first aid or immediate treatment described",
    "order": 13
  },
  {
    "key": "called_911",
    "label": "911 Called",
    "label_es": "Se Llamo al 911",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if 911 was called from the description",
    "variant": "button",
    "width": "half",
    "order": 14
  },
  {
    "key": "transported_to_hospital",
    "label": "Transported to Hospital",
    "label_es": "Transportado al Hospital",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if the employee was taken to a hospital",
    "variant": "button",
    "width": "half",
    "order": 15
  },
  {
    "key": "hospital_contact",
    "label": "Hospital / Medical Facility",
    "label_es": "Hospital / Centro Medico",
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
    "order": 16
  },
  {
    "key": "regional_notified",
    "label": "Regional Manager Notified",
    "label_es": "Gerente Regional Notificado",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if the regional manager was notified",
    "variant": "button",
    "width": "half",
    "order": 17
  },
  {
    "key": "witnesses_present",
    "label": "Witnesses Present",
    "label_es": "Testigos Presentes",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "ai_hint": "Determine if any witnesses were present from the description",
    "variant": "button",
    "width": "half",
    "order": 18
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
    "order": 19
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
    "order": 20
  },
  {
    "key": "section_root_cause",
    "label": "Root Cause",
    "label_es": "Causa Raiz",
    "type": "header",
    "required": false,
    "order": 21
  },
  {
    "key": "cause",
    "label": "What Caused the Injury",
    "label_es": "Que Causo la Lesion",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe the root cause...",
    "ai_hint": "Assess what led to the injury",
    "order": 22
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
    "variant": "button",
    "order": 23
  },
  {
    "key": "corrective_action",
    "label": "Corrective Action Taken",
    "label_es": "Accion Correctiva Tomada",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any corrective action taken or recommended",
    "ai_hint": "Document any corrective actions mentioned, or suggest appropriate ones based on the root cause",
    "order": 24
  },
  {
    "key": "section_signatures",
    "label": "Documentation & Signatures",
    "label_es": "Documentacion y Firmas",
    "type": "header",
    "required": false,
    "order": 25
  },
  {
    "key": "supporting_docs",
    "label": "Supporting Documents",
    "label_es": "Documentos de Soporte",
    "type": "file",
    "required": false,
    "hint": "Upload any additional supporting documents",
    "order": 26
  },
  {
    "key": "employee_signature",
    "label": "Injured Employee Signature",
    "label_es": "Firma del Empleado Lesionado",
    "type": "signature",
    "required": false,
    "hint": "If the employee is able to sign",
    "order": 27
  },
  {
    "key": "manager_signature",
    "label": "Manager on Duty Signature",
    "label_es": "Firma del Gerente en Turno",
    "type": "signature",
    "required": true,
    "hint": "Manager on duty signature",
    "order": 28
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "ai_hint": "Default to today's date",
    "width": "half",
    "order": 29
  }
]$JSONB$::JSONB,
template_version = template_version + 1
WHERE slug = 'employee-injury-report';
