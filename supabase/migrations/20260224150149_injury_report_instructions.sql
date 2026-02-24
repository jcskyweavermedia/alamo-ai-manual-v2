-- =============================================================================
-- MIGRATION: injury_report_instructions
-- Adds an instructions field at the top of the Employee Injury Report form.
-- AI will eventually populate this from the operations manual; for now, static
-- step-by-step guidance for managers handling a workplace injury.
-- =============================================================================

UPDATE public.form_templates
SET fields = $JSONB$[
  {
    "key": "instructions_top",
    "label": "Workplace Injury Response Protocol",
    "label_es": "Protocolo de Respuesta ante Lesiones Laborales",
    "type": "instructions",
    "required": false,
    "hint": "1. Ensure the scene is safe — do not move the injured employee unless there is immediate danger.\n2. Call 911 if the injury is serious, the employee is unresponsive, or you are unsure of the severity.\n3. Administer basic first aid if trained to do so. Refer to the First Aid Kit located near the manager's station.\n4. Notify your Regional Manager or HR Department immediately.\n5. Complete all fields in this report while details are fresh — accuracy matters for compliance.\n6. If the employee requires hospital transport, send them to the designated facility with a copy of this form.\n7. Preserve the scene and take photos before cleaning up.\n8. Collect witness statements from anyone who saw the incident.",
    "hint_es": "1. Asegure que la escena sea segura — no mueva al empleado lesionado a menos que haya peligro inmediato.\n2. Llame al 911 si la lesion es grave, el empleado no responde, o no esta seguro de la gravedad.\n3. Administre primeros auxilios basicos si esta capacitado. Consulte el botiquin ubicado cerca de la estacion del gerente.\n4. Notifique a su Gerente Regional o Departamento de Recursos Humanos inmediatamente.\n5. Complete todos los campos de este reporte mientras los detalles estan frescos — la precision es importante para el cumplimiento.\n6. Si el empleado requiere transporte al hospital, envielo al centro medico designado con una copia de este formulario.\n7. Preserve la escena y tome fotos antes de limpiar.\n8. Recopile declaraciones de testigos de cualquier persona que haya visto el incidente.",
    "order": 1
  },
  {
    "key": "section_injured_employee",
    "label": "Injured Employee",
    "label_es": "Empleado Lesionado",
    "type": "header",
    "required": false,
    "order": 2
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
    "order": 3
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
    "order": 4
  },
  {
    "key": "section_incident_details",
    "label": "Incident Details",
    "label_es": "Detalles del Incidente",
    "type": "header",
    "required": false,
    "order": 5
  },
  {
    "key": "date_of_injury",
    "label": "Date of Injury",
    "label_es": "Fecha de la Lesion",
    "type": "date",
    "required": true,
    "ai_hint": "Extract the date of injury. If 'today' is mentioned, use the current date.",
    "width": "half",
    "order": 6
  },
  {
    "key": "time_of_injury",
    "label": "Time of Injury",
    "label_es": "Hora de la Lesion",
    "type": "time",
    "required": true,
    "ai_hint": "Extract the time. Convert to 24h format (e.g., '3pm' = '15:00').",
    "width": "half",
    "order": 7
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
    "order": 8
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
    "order": 9
  },
  {
    "key": "description",
    "label": "Description of Injury",
    "label_es": "Descripcion de la Lesion",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened in detail...",
    "ai_hint": "Document exactly what happened — when, where, how. Be specific and factual.",
    "order": 10
  },
  {
    "key": "body_parts",
    "label": "Body Part(s) Affected",
    "label_es": "Parte(s) del Cuerpo Afectada(s)",
    "type": "checkbox",
    "required": true,
    "options": ["Head", "Neck", "Back", "Shoulder", "Arm", "Hand", "Finger", "Leg", "Knee", "Foot", "Torso", "Other"],
    "ai_hint": "Identify all body parts affected from the injury description",
    "order": 11
  },
  {
    "key": "injury_photos",
    "label": "Photos of Injury / Scene",
    "label_es": "Fotos de la Lesion / Escena",
    "type": "image",
    "required": false,
    "hint": "Take photos of the injury and scene before anything changes",
    "order": 12
  },
  {
    "key": "section_immediate_response",
    "label": "Immediate Response",
    "label_es": "Respuesta Inmediata",
    "type": "header",
    "required": false,
    "order": 13
  },
  {
    "key": "first_aid",
    "label": "First Aid Administered",
    "label_es": "Primeros Auxilios Administrados",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any first aid administered",
    "ai_hint": "Document any first aid or immediate treatment described",
    "order": 14
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
    "order": 15
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
    "order": 16
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
    "order": 17
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
    "order": 18
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
    "order": 19
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
    "order": 20
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
    "order": 21
  },
  {
    "key": "section_root_cause",
    "label": "Root Cause",
    "label_es": "Causa Raiz",
    "type": "header",
    "required": false,
    "order": 22
  },
  {
    "key": "cause",
    "label": "What Caused the Injury",
    "label_es": "Que Causo la Lesion",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe the root cause...",
    "ai_hint": "Assess what led to the injury",
    "order": 23
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
    "order": 24
  },
  {
    "key": "corrective_action",
    "label": "Corrective Action Taken",
    "label_es": "Accion Correctiva Tomada",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any corrective action taken or recommended",
    "ai_hint": "Document any corrective actions mentioned, or suggest appropriate ones based on the root cause",
    "order": 25
  },
  {
    "key": "section_signatures",
    "label": "Documentation & Signatures",
    "label_es": "Documentacion y Firmas",
    "type": "header",
    "required": false,
    "order": 26
  },
  {
    "key": "supporting_docs",
    "label": "Supporting Documents",
    "label_es": "Documentos de Soporte",
    "type": "file",
    "required": false,
    "hint": "Upload any additional supporting documents",
    "order": 27
  },
  {
    "key": "employee_signature",
    "label": "Injured Employee Signature",
    "label_es": "Firma del Empleado Lesionado",
    "type": "signature",
    "required": false,
    "hint": "If the employee is able to sign",
    "order": 28
  },
  {
    "key": "manager_signature",
    "label": "Manager on Duty Signature",
    "label_es": "Firma del Gerente en Turno",
    "type": "signature",
    "required": true,
    "hint": "Manager on duty signature",
    "order": 29
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "ai_hint": "Default to today's date",
    "width": "half",
    "order": 30
  }
]$JSONB$::JSONB,
template_version = template_version + 1
WHERE slug = 'employee-injury-report';
