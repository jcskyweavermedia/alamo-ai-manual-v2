-- ============================================
-- CONTENT: Employee Handbook (EN + ES) — all 8 sections
-- ============================================

BEGIN;

-- ============================================
-- 1. EMPLOYEE HANDBOOK OVERVIEW
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Employee Handbook Overview

## Welcome to the Team

> **💡 Our Commitment**: At Alamo Prime, every team member is essential to delivering exceptional guest experiences. This handbook outlines the expectations, policies, and values that guide our workplace.

This handbook applies to all Alamo Prime team members — front of house, back of house, and management. It is a living document and will be updated as our team grows.

---

## What This Handbook Covers

This handbook is organized into six key areas:

- **Attendance & Punctuality** — Scheduling expectations, tardiness, and call-out procedures
- **Professional Conduct & Attitude** — How we treat guests, teammates, and the workplace
- **Dress Code & Appearance** — Uniform and grooming standards
- **Time Off & Vacation** — PTO, sick leave, holiday, and request procedures
- **Performance Standards** — How we evaluate and develop team members
- **Disciplinary Policy** — Progressive discipline and conduct violations

---

## Your Acknowledgment

By joining Alamo Prime, you agree to:

1. Read and understand the policies in this handbook
2. Ask your manager if anything is unclear
3. Uphold these standards every shift
4. Help create a respectful, high-performance team environment

> **ℹ️ Note**: This handbook does not constitute a contract of employment. Policies may be updated at any time with reasonable notice.

---

## Our Promise to You

Alamo Prime is committed to:

- **Clear expectations** — You will always know what is expected of you
- **Fair treatment** — All team members are held to the same standards
- **Open communication** — Your voice matters; speak to your manager or GM at any time
- **Growth opportunities** — We promote from within and invest in your development
$MD$
WHERE slug = 'employee-handbook-overview';

UPDATE public.manual_sections
SET content_es = $MD$
# Visión General del Manual del Empleado

## Bienvenido al Equipo

> **💡 Nuestro Compromiso**: En Alamo Prime, cada miembro del equipo es esencial para brindar experiencias excepcionales a nuestros huéspedes. Este manual describe las expectativas, políticas y valores que guían nuestro lugar de trabajo.

Este manual aplica a todos los miembros del equipo de Alamo Prime — sala, cocina y gerencia. Es un documento vivo y se actualizará conforme crece nuestro equipo.

---

## Qué Cubre Este Manual

Este manual está organizado en seis áreas clave:

- **Asistencia y Puntualidad** — Expectativas de horario, tardanzas y procedimientos de ausencia
- **Conducta Profesional y Actitud** — Cómo tratamos a los huéspedes, compañeros y el lugar de trabajo
- **Código de Vestimenta y Apariencia** — Estándares de uniforme y presentación personal
- **Tiempo Libre y Vacaciones** — PTO, incapacidades, días festivos y procedimientos de solicitud
- **Estándares de Desempeño** — Cómo evaluamos y desarrollamos a los miembros del equipo
- **Política Disciplinaria** — Disciplina progresiva y violaciones de conducta

---

## Tu Reconocimiento

Al unirte a Alamo Prime, aceptas:

1. Leer y comprender las políticas de este manual
2. Preguntar a tu gerente si algo no está claro
3. Cumplir con estos estándares en cada turno
4. Ayudar a crear un ambiente de equipo respetuoso y de alto desempeño

> **ℹ️ Nota**: Este manual no constituye un contrato de empleo. Las políticas pueden actualizarse en cualquier momento con aviso razonable.

---

## Nuestra Promesa Para Ti

Alamo Prime se compromete a:

- **Expectativas claras** — Siempre sabrás lo que se espera de ti
- **Trato justo** — Todos los miembros del equipo son evaluados con los mismos estándares
- **Comunicación abierta** — Tu voz importa; habla con tu gerente o GM en cualquier momento
- **Oportunidades de crecimiento** — Promovemos desde dentro e invertimos en tu desarrollo
$MD$
WHERE slug = 'employee-handbook-overview';

-- ============================================
-- 2. ATTENDANCE & PUNCTUALITY
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Attendance & Punctuality

Reliable attendance is one of the most important responsibilities of every Alamo Prime team member. Our guests and teammates depend on you to be present and on time.

> **⚠️ Critical**: Excessive tardiness or unexcused absences are grounds for disciplinary action up to and including termination.

---

## Scheduling

- Schedules are posted **weekly**, typically by Thursday for the following week
- It is your responsibility to check your schedule and confirm your shifts
- Schedule requests must be submitted **at least 7 days in advance**
- Last-minute schedule changes require manager approval

---

## Punctuality Standards

| Expectation | Standard |
|-------------|----------|
| Arrival | Report **ready to work** (in uniform, clocked in) at your scheduled start time |
| Grace Period | None — being on time means being early |
| Tardiness | Arriving after your scheduled start time is considered tardy |
| Threshold | 3 or more tardies in a 30-day period triggers a formal review |

### What Counts as Tardy
- Arriving after your scheduled start time
- Not being in uniform and ready to work at start time
- Clocking in late due to personal reasons

---

## Absence Procedures

### Calling Out
If you are unable to work a scheduled shift, you **must**:

1. Notify your manager **at least 2 hours before** your shift starts
2. Call or text the manager on duty — do not rely solely on messaging apps
3. Make every effort to find a shift replacement and notify management of the outcome

> **⚠️ No Call / No Show**: Failing to notify management before your shift is a serious violation. A second no-call/no-show may result in immediate termination.

### Unexcused Absences
An absence is unexcused if:
- You did not notify management at least 2 hours in advance
- You could not provide a valid reason
- You had a no-call/no-show

### Excused Absences
The following may be excused with proper documentation:
- Documented medical illness
- Family emergency
- Court or legal obligation
- Pre-approved time off

---

## Attendance Tracking

- All attendance is tracked via the timekeeping system
- Patterns of absence or tardiness are reviewed monthly by management
- Attendance history is considered during performance reviews

---

## Shift Swaps & Coverage

- All shift swaps must be **approved by a manager in advance**
- You are responsible for your shift until a swap is confirmed
- Informal swaps without manager approval are not recognized
$MD$
WHERE slug = 'attendance-punctuality';

UPDATE public.manual_sections
SET content_es = $MD$
# Asistencia y Puntualidad

La asistencia confiable es una de las responsabilidades más importantes de cada miembro del equipo de Alamo Prime. Nuestros huéspedes y compañeros dependen de que estés presente y puntual.

> **⚠️ Crítico**: La tardanza excesiva o las ausencias injustificadas son motivo de acción disciplinaria que puede incluir la terminación de contrato.

---

## Programación de Horarios

- Los horarios se publican **semanalmente**, generalmente los jueves para la semana siguiente
- Es tu responsabilidad revisar tu horario y confirmar tus turnos
- Las solicitudes de cambio de horario deben presentarse **con al menos 7 días de anticipación**
- Los cambios de última hora requieren aprobación del gerente

---

## Estándares de Puntualidad

| Expectativa | Estándar |
|-------------|----------|
| Llegada | Presentarse **listo para trabajar** (uniformado y registrado) a la hora de inicio programada |
| Período de gracia | Ninguno — ser puntual significa llegar antes |
| Tardanza | Llegar después de la hora de inicio programada se considera tardanza |
| Umbral | 3 o más tardanzas en un período de 30 días activa una revisión formal |

### Qué Se Considera Tardanza
- Llegar después de tu hora de inicio programada
- No estar uniformado y listo para trabajar a la hora de inicio
- Registrar tarde por razones personales

---

## Procedimientos de Ausencia

### Avisar que No Asistirás
Si no puedes trabajar un turno programado, **debes**:

1. Notificar a tu gerente **con al menos 2 horas de anticipación** antes de tu turno
2. Llamar o enviar mensaje al gerente de turno — no dependas únicamente de aplicaciones de mensajería
3. Hacer todo lo posible por encontrar un reemplazo e informar al gerente del resultado

> **⚠️ Sin Aviso / Sin Presentarse**: No notificar a la gerencia antes de tu turno es una violación grave. Un segundo caso puede resultar en terminación inmediata.

### Ausencias Injustificadas
Una ausencia es injustificada si:
- No notificaste a la gerencia con al menos 2 horas de anticipación
- No pudiste proporcionar una razón válida
- Fue un caso de no aviso / no presentarse

### Ausencias Justificadas
Las siguientes pueden ser justificadas con documentación apropiada:
- Enfermedad médica documentada
- Emergencia familiar
- Obligación legal o judicial
- Tiempo libre aprobado previamente

---

## Registro de Asistencia

- Toda la asistencia se registra a través del sistema de control de tiempo
- Los patrones de ausencia o tardanza son revisados mensualmente por la gerencia
- El historial de asistencia se considera en las evaluaciones de desempeño

---

## Cambios de Turno y Cobertura

- Todos los cambios de turno deben ser **aprobados por un gerente con anticipación**
- Eres responsable de tu turno hasta que se confirme un cambio
- Los cambios informales sin aprobación del gerente no son reconocidos
$MD$
WHERE slug = 'attendance-punctuality';

-- ============================================
-- 3. PROFESSIONAL CONDUCT & ATTITUDE
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Professional Conduct & Attitude

At Alamo Prime, how we treat each other and our guests defines who we are. A positive attitude and respectful conduct are non-negotiable — they are the foundation of our culture.

> **💡 Our Standard**: We hold ourselves to the highest standard of professionalism in every interaction — with guests, with teammates, and with management.

---

## Core Conduct Expectations

Every team member is expected to:

- **Arrive ready**: Come to work with a positive, can-do attitude
- **Be a team player**: Support your teammates without being asked
- **Stay professional**: Maintain composure under pressure
- **Communicate respectfully**: Address concerns through appropriate channels
- **Represent the brand**: Conduct yourself as a reflection of Alamo Prime at all times

---

## Guest Interactions

Our guests are the reason we are here. Every interaction must reflect our commitment to excellence:

- Greet every guest warmly and promptly
- Use a friendly, professional tone — no slang, profanity, or inappropriate language
- Never argue with a guest — escalate to a manager when needed
- Anticipate needs before being asked
- Thank guests sincerely when they leave

> **⚠️ Zero Tolerance**: Rude, dismissive, or disrespectful behavior toward guests is a serious violation.

---

## Teammate Respect

We succeed together or not at all:

- Treat all teammates with dignity and respect, regardless of position or seniority
- **Harassment, bullying, or discrimination of any kind is strictly prohibited**
- Gossip and negative talk about coworkers or management is not acceptable
- Conflicts must be addressed calmly and professionally — involve a manager if needed
- Celebrate each other's successes and offer help without being prompted

---

## Phone & Personal Device Policy

| Situation | Policy |
|-----------|--------|
| During service | Personal phones must be away and out of sight |
| Break time | Personal phones are permitted in designated break areas |
| Emergencies | Notify your manager; they will accommodate urgent situations |
| Social media | Do not post about guests, shifts, or the restaurant without authorization |

---

## Workplace Environment

- Keep work areas clean and organized at all times
- Report any safety hazard immediately to a manager
- Do not consume food or beverages in guest-facing areas without permission
- Maintain a positive energy on the floor — guests and teammates feel it

---

## Conflict Resolution

1. Address issues directly and respectfully with the other party when safe to do so
2. If unresolved, bring the concern to your direct manager
3. For serious issues (harassment, discrimination), go directly to the General Manager
4. All complaints are taken seriously and handled with confidentiality
$MD$
WHERE slug = 'professional-conduct';

UPDATE public.manual_sections
SET content_es = $MD$
# Conducta Profesional y Actitud

En Alamo Prime, la forma en que nos tratamos mutuamente y a nuestros huéspedes define quiénes somos. Una actitud positiva y una conducta respetuosa no son negociables — son la base de nuestra cultura.

> **💡 Nuestro Estándar**: Nos mantenemos en el más alto estándar de profesionalismo en cada interacción — con huéspedes, compañeros y gerencia.

---

## Expectativas de Conducta Básica

Cada miembro del equipo debe:

- **Llegar listo**: Presentarse al trabajo con una actitud positiva y proactiva
- **Ser un jugador de equipo**: Apoyar a sus compañeros sin que se lo pidan
- **Mantenerse profesional**: Conservar la calma bajo presión
- **Comunicarse con respeto**: Expresar preocupaciones a través de los canales apropiados
- **Representar la marca**: Conducirse como un reflejo de Alamo Prime en todo momento

---

## Interacciones con Huéspedes

Nuestros huéspedes son la razón por la que estamos aquí. Cada interacción debe reflejar nuestro compromiso con la excelencia:

- Saludar a cada huésped de manera cálida y oportuna
- Usar un tono amigable y profesional — sin jerga, groserías o lenguaje inapropiado
- Nunca discutir con un huésped — escalar al gerente cuando sea necesario
- Anticipar las necesidades antes de que sean solicitadas
- Agradecer sinceramente a los huéspedes cuando se vayan

> **⚠️ Tolerancia Cero**: El comportamiento grosero, despectivo o irrespetuoso hacia los huéspedes es una violación grave.

---

## Respeto entre Compañeros

Tenemos éxito juntos o no lo tenemos:

- Tratar a todos los compañeros con dignidad y respeto, independientemente de su posición o antigüedad
- **El acoso, la intimidación o la discriminación de cualquier tipo está estrictamente prohibida**
- Los chismes y comentarios negativos sobre compañeros o gerencia no son aceptables
- Los conflictos deben abordarse con calma y profesionalismo — involucrar a un gerente si es necesario
- Celebrar los éxitos de los demás y ofrecer ayuda sin que se lo pidan

---

## Política de Teléfonos y Dispositivos Personales

| Situación | Política |
|-----------|----------|
| Durante el servicio | Los teléfonos personales deben estar guardados y fuera de vista |
| Tiempo de descanso | Los teléfonos personales están permitidos en áreas de descanso designadas |
| Emergencias | Notificar al gerente; se accommodarán situaciones urgentes |
| Redes sociales | No publicar sobre huéspedes, turnos o el restaurante sin autorización |

---

## Ambiente de Trabajo

- Mantener las áreas de trabajo limpias y organizadas en todo momento
- Reportar cualquier peligro de seguridad inmediatamente al gerente
- No consumir alimentos o bebidas en áreas de atención al huésped sin permiso
- Mantener una energía positiva en el piso — los huéspedes y compañeros lo sienten

---

## Resolución de Conflictos

1. Abordar los problemas directamente y con respeto con la otra parte cuando sea seguro hacerlo
2. Si no se resuelve, llevar la preocupación al gerente directo
3. Para problemas graves (acoso, discriminación), ir directamente al Gerente General
4. Todas las quejas se toman en serio y se manejan con confidencialidad
$MD$
WHERE slug = 'professional-conduct';

-- ============================================
-- 4. DRESS CODE & APPEARANCE
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Dress Code & Appearance

Your appearance is the first impression our guests have of Alamo Prime. A clean, professional, and consistent look reflects our brand and instills guest confidence.

> **💡 First Impressions**: Guests form an opinion within seconds. Your uniform and grooming are part of the guest experience.

---

## Uniform Standards

| Item | Standard |
|------|----------|
| Shirt / Top | Provided Alamo Prime uniform top — clean, pressed, no stains |
| Pants | Black dress pants or approved dark jeans — no rips, tears, or fading |
| Shoes | Clean, non-slip, closed-toe black shoes |
| Apron | Provided apron when applicable — must be clean at start of shift |
| Name tag | Worn at all times during service |

### Condition Requirements
- All uniform items must be **clean and in good condition** at the start of every shift
- Torn, faded, or visibly damaged uniforms must be replaced before working
- Uniforms are to be worn **only during working hours**

---

## Grooming & Hygiene

### Hair
- Hair must be **clean and neat**
- Long hair (shoulder length or longer) must be tied back during service
- Unnatural colors are permitted if kept neat and professional

### Facial Hair
- Must be **clean and trimmed** — no unkempt beards or stubble
- Food handlers: facial hair must comply with health code requirements

### Nails & Hands
- Nails must be **short and clean**
- Kitchen team: no nail polish or artificial nails
- FOH team: nail polish is permitted in neutral or conservative colors

### Fragrance
- Cologne and perfume should be **minimal** — strong fragrances can affect the dining experience

### Jewelry
- Keep jewelry minimal and professional
- Kitchen team: no rings, bracelets, or dangling jewelry for safety reasons
- Visible piercings: small and unobtrusive only

---

## What is Not Permitted

- Visible tattoos containing offensive imagery or language
- Sunglasses worn indoors during service
- Hats (unless part of approved uniform)
- Ripped or distressed clothing
- Overly casual footwear (flip-flops, sandals, sneakers)

---

## Uniform Compliance

Arriving out of uniform or with poor grooming may result in:
1. Being sent home to change before the shift
2. A tardiness mark if you return late
3. Formal counseling after repeated violations
$MD$
WHERE slug = 'dress-code-appearance';

UPDATE public.manual_sections
SET content_es = $MD$
# Código de Vestimenta y Apariencia

Tu apariencia es la primera impresión que nuestros huéspedes tienen de Alamo Prime. Una imagen limpia, profesional y consistente refleja nuestra marca y genera confianza en los huéspedes.

> **💡 Primeras Impresiones**: Los huéspedes forman una opinión en segundos. Tu uniforme y presentación son parte de la experiencia del huésped.

---

## Estándares de Uniforme

| Artículo | Estándar |
|----------|----------|
| Camisa / Parte superior | Uniforme de Alamo Prime provisto — limpio, planchado, sin manchas |
| Pantalones | Pantalón de vestir negro o jeans oscuros aprobados — sin roturas ni decoloración |
| Zapatos | Zapatos negros limpios, antideslizantes y cerrados |
| Delantal | Delantal provisto cuando aplique — debe estar limpio al inicio del turno |
| Gafete | Usar en todo momento durante el servicio |

### Requisitos de Condición
- Todos los artículos del uniforme deben estar **limpios y en buenas condiciones** al inicio de cada turno
- Los uniformes rotos, decolorados o visiblemente dañados deben reemplazarse antes de trabajar
- Los uniformes deben usarse **solo durante las horas de trabajo**

---

## Aseo e Higiene

### Cabello
- El cabello debe estar **limpio y ordenado**
- El cabello largo (altura de hombros o más) debe estar recogido durante el servicio
- Los colores no naturales están permitidos si se mantienen ordenados y profesionales

### Vello Facial
- Debe estar **limpio y recortado** — sin barbas o barba sin afeitar descuidadas
- Manipuladores de alimentos: el vello facial debe cumplir con los requisitos del código de salud

### Uñas y Manos
- Las uñas deben ser **cortas y limpias**
- Equipo de cocina: sin esmalte de uñas ni uñas artificiales
- Equipo de sala: el esmalte de uñas está permitido en colores neutros o conservadores

### Fragancia
- El perfume y la colonia deben ser **mínimos** — las fragancias fuertes pueden afectar la experiencia gastronómica

### Joyería
- Mantener la joyería mínima y profesional
- Equipo de cocina: sin anillos, pulseras ni joyería colgante por razones de seguridad
- Perforaciones visibles: solo pequeñas y discretas

---

## Lo que No Está Permitido

- Tatuajes visibles con imágenes u lenguaje ofensivo
- Gafas de sol usadas en interiores durante el servicio
- Gorras (a menos que sean parte del uniforme aprobado)
- Ropa rota o en mal estado
- Calzado demasiado casual (chancletas, sandalias, tenis)

---

## Cumplimiento del Uniforme

Llegar sin uniforme o con mala presentación puede resultar en:
1. Ser enviado a casa a cambiarse antes del turno
2. Una marca de tardanza si regresa tarde
3. Asesoramiento formal después de violaciones repetidas
$MD$
WHERE slug = 'dress-code-appearance';

-- ============================================
-- 5. TIME OFF & VACATION
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Time Off & Vacation

Alamo Prime values work-life balance. We offer time off benefits to support our team members' wellbeing while maintaining the staffing levels our guests and operations require.

> **ℹ️ Note**: Specific accrual rates and eligibility may vary based on your position, hours worked, and applicable local law. Consult your manager or the GM for your individual details.

---

## Types of Time Off

### Vacation (PTO)
- Full-time team members begin accruing vacation time after **90 days of employment**
- Part-time team members may be eligible depending on hours and local requirements
- Accrued vacation must be **requested and approved in advance**
- Unused vacation does not automatically carry over — check with management for year-end policy

### Sick Leave
- Team members are entitled to sick leave in accordance with applicable law
- For shifts missed due to illness, notify management as early as possible
- Excessive sick leave usage may require medical documentation

### Holidays
| Holiday | Policy |
|---------|--------|
| Major holidays | Restaurant may operate; holiday pay or comp time may apply |
| Personal holidays | Treated as PTO requests; subject to availability |
| Holiday scheduling | Seniority and business needs determine holiday assignments |

---

## Requesting Time Off

### How to Request
1. Submit your request through the scheduling system or to your direct manager
2. Submit **at least 14 days in advance** for vacation requests
3. For urgent/personal days, submit as early as possible
4. Requests are not confirmed until you receive written or verbal manager approval

### Approval Criteria
Requests are evaluated based on:
- Business needs and staffing levels
- Advance notice provided
- Your current attendance record
- Seniority (when multiple requests overlap the same dates)

> **⚠️ Important**: A submitted request is NOT approved time off. Wait for confirmation before making travel or personal plans.

---

## Leave of Absence

For extended absences (medical, family, personal), speak directly with the General Manager. Alamo Prime will comply with all applicable leave laws (FMLA, local sick leave laws, etc.).

---

## Blackout Periods

Certain high-volume periods may be designated as blackout periods during which time-off requests may not be approved. You will be notified of blackout dates in advance when possible.

Examples of typical blackout periods:
- Valentine's Day weekend
- Mother's Day
- Major sporting events or private buyouts
- Year-end holiday season (varies by location)
$MD$
WHERE slug = 'time-off-vacation';

UPDATE public.manual_sections
SET content_es = $MD$
# Tiempo Libre y Vacaciones

Alamo Prime valora el equilibrio entre trabajo y vida personal. Ofrecemos beneficios de tiempo libre para apoyar el bienestar de nuestros miembros del equipo, manteniendo al mismo tiempo los niveles de personal que nuestros huéspedes y operaciones requieren.

> **ℹ️ Nota**: Las tasas de acumulación específicas y la elegibilidad pueden variar según tu posición, horas trabajadas y la ley local aplicable. Consulta con tu gerente o el GM para conocer tus detalles individuales.

---

## Tipos de Tiempo Libre

### Vacaciones (PTO)
- Los miembros de tiempo completo comienzan a acumular tiempo de vacaciones después de **90 días de empleo**
- Los miembros de tiempo parcial pueden ser elegibles dependiendo de las horas y los requisitos locales
- Las vacaciones acumuladas deben **solicitarse y aprobarse con anticipación**
- Las vacaciones no utilizadas no se transfieren automáticamente — consulta con la gerencia para la política de fin de año

### Licencia por Enfermedad
- Los miembros del equipo tienen derecho a licencia por enfermedad de acuerdo con la ley aplicable
- Para turnos perdidos por enfermedad, notifica a la gerencia lo antes posible
- El uso excesivo de licencia por enfermedad puede requerir documentación médica

### Días Festivos
| Festivo | Política |
|---------|----------|
| Días festivos importantes | El restaurante puede operar; puede aplicar pago de festivo o tiempo compensatorio |
| Días festivos personales | Se tratan como solicitudes de PTO; sujetos a disponibilidad |
| Programación de festivos | La antigüedad y las necesidades del negocio determinan las asignaciones de festivos |

---

## Solicitud de Tiempo Libre

### Cómo Solicitar
1. Envía tu solicitud a través del sistema de programación o a tu gerente directo
2. Envía **con al menos 14 días de anticipación** para solicitudes de vacaciones
3. Para días urgentes/personales, envía lo antes posible
4. Las solicitudes no se confirman hasta que recibas la aprobación escrita o verbal del gerente

### Criterios de Aprobación
Las solicitudes se evalúan con base en:
- Necesidades del negocio y niveles de personal
- Aviso previo proporcionado
- Tu historial de asistencia actual
- Antigüedad (cuando múltiples solicitudes coinciden en las mismas fechas)

> **⚠️ Importante**: Una solicitud enviada NO es tiempo libre aprobado. Espera la confirmación antes de hacer planes de viaje o personales.

---

## Licencia de Ausencia

Para ausencias prolongadas (médicas, familiares, personales), habla directamente con el Gerente General. Alamo Prime cumplirá con todas las leyes de licencia aplicables (FMLA, leyes locales de licencia por enfermedad, etc.).

---

## Períodos de Bloqueo

Ciertos períodos de alto volumen pueden designarse como períodos de bloqueo durante los cuales las solicitudes de tiempo libre pueden no ser aprobadas. Se te notificará de las fechas de bloqueo con anticipación cuando sea posible.

Ejemplos de períodos de bloqueo típicos:
- Fin de semana de San Valentín
- Día de las Madres
- Eventos deportivos importantes o cierres privados
- Temporada de fiestas de fin de año (varía según la ubicación)
$MD$
WHERE slug = 'time-off-vacation';

-- ============================================
-- 6. PERFORMANCE STANDARDS
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Performance Standards

At Alamo Prime, we are committed to helping every team member succeed. Clear performance standards allow us to give consistent feedback, recognize excellence, and identify areas for growth.

> **💡 Our Approach**: Performance management is not about punishment — it is about development, clarity, and helping you do your best work.

---

## Core Performance Expectations

Every team member is evaluated on the following dimensions:

| Dimension | What We Look For |
|-----------|-----------------|
| **Guest Experience** | Warm, professional interactions; anticipates needs; handles issues gracefully |
| **Attendance & Reliability** | On time, prepared, minimal unexcused absences |
| **Job Knowledge** | Understands menu, procedures, and role responsibilities |
| **Teamwork** | Supports colleagues, communicates effectively, takes initiative |
| **Attitude & Conduct** | Positive, respectful, receptive to feedback |
| **Standards Compliance** | Follows uniform, safety, and operational standards |

---

## Performance Reviews

### Frequency
- **30-day check-in**: For new team members — informal, developmental
- **90-day review**: Formal evaluation at end of probationary period
- **Annual review**: Every 12 months for all active team members
- **As-needed**: Any time performance concerns arise

### What to Expect
1. Your manager will schedule a private meeting
2. You will discuss strengths, areas for improvement, and goals
3. You may share your own feedback on your experience
4. A written summary will be provided and signed by both parties

---

## Goal Setting

Following each review, you and your manager will establish:
- **Short-term goals** (30–90 days): Specific behaviors or skills to improve
- **Development goals**: Training, certifications, or advancement targets
- **Recognition milestones**: What exceptional performance looks like

---

## Recognition & Advancement

High performers at Alamo Prime are recognized through:
- **Verbal and written recognition** from management
- **Team shout-outs** at pre-shift meetings
- **Advancement opportunities** — we promote from within whenever possible
- **Increased responsibilities** — lead shifts, mentoring, cross-training

> **💡 Growth Path**: Strong performance is the clearest path to advancement in our organization.

---

## Continuous Feedback

You do not have to wait for a formal review to discuss your performance:
- Ask your manager for feedback after any shift
- Bring up concerns or goals during one-on-one conversations
- Use pre-shift meetings to stay aligned on expectations
$MD$
WHERE slug = 'performance-standards';

UPDATE public.manual_sections
SET content_es = $MD$
# Estándares de Desempeño

En Alamo Prime, estamos comprometidos a ayudar a cada miembro del equipo a tener éxito. Los estándares de desempeño claros nos permiten dar retroalimentación consistente, reconocer la excelencia e identificar áreas de crecimiento.

> **💡 Nuestro Enfoque**: La gestión del desempeño no se trata de castigo — se trata de desarrollo, claridad y ayudarte a hacer tu mejor trabajo.

---

## Expectativas Básicas de Desempeño

Cada miembro del equipo es evaluado en las siguientes dimensiones:

| Dimensión | Lo que Buscamos |
|-----------|-----------------|
| **Experiencia del Huésped** | Interacciones cálidas y profesionales; anticipa necesidades; maneja problemas con gracia |
| **Asistencia y Confiabilidad** | Puntual, preparado, ausencias injustificadas mínimas |
| **Conocimiento del Puesto** | Comprende el menú, los procedimientos y las responsabilidades del rol |
| **Trabajo en Equipo** | Apoya a los colegas, se comunica efectivamente, toma iniciativa |
| **Actitud y Conducta** | Positivo, respetuoso, receptivo a la retroalimentación |
| **Cumplimiento de Estándares** | Sigue los estándares de uniforme, seguridad y operaciones |

---

## Evaluaciones de Desempeño

### Frecuencia
- **Revisión a los 30 días**: Para nuevos miembros del equipo — informal, de desarrollo
- **Revisión a los 90 días**: Evaluación formal al final del período de prueba
- **Revisión anual**: Cada 12 meses para todos los miembros activos del equipo
- **Según se necesite**: Cada vez que surjan preocupaciones de desempeño

### Qué Esperar
1. Tu gerente programará una reunión privada
2. Discutirán fortalezas, áreas de mejora y metas
3. Podrás compartir tu propia retroalimentación sobre tu experiencia
4. Se proporcionará un resumen escrito firmado por ambas partes

---

## Establecimiento de Metas

Después de cada evaluación, tú y tu gerente establecerán:
- **Metas a corto plazo** (30–90 días): Comportamientos o habilidades específicos a mejorar
- **Metas de desarrollo**: Capacitación, certificaciones u objetivos de avance
- **Hitos de reconocimiento**: Cómo se ve el desempeño excepcional

---

## Reconocimiento y Avance

Los de alto rendimiento en Alamo Prime son reconocidos a través de:
- **Reconocimiento verbal y escrito** de la gerencia
- **Reconocimientos del equipo** en reuniones previas al turno
- **Oportunidades de avance** — promovemos desde dentro siempre que sea posible
- **Responsabilidades incrementadas** — turnos de liderazgo, mentoría, capacitación cruzada

> **💡 Camino de Crecimiento**: El desempeño sólido es el camino más claro hacia el avance en nuestra organización.

---

## Retroalimentación Continua

No tienes que esperar una evaluación formal para discutir tu desempeño:
- Pide retroalimentación a tu gerente después de cualquier turno
- Plantea preocupaciones o metas durante conversaciones individuales
- Usa las reuniones previas al turno para mantenerte alineado con las expectativas
$MD$
WHERE slug = 'performance-standards';

-- ============================================
-- 7. DISCIPLINARY POLICY
-- ============================================

UPDATE public.manual_sections
SET content_en = $MD$
# Disciplinary Policy

Alamo Prime is committed to maintaining a professional, safe, and high-performance work environment. When conduct or performance falls below expectations, we follow a fair and consistent disciplinary process.

> **ℹ️ Note**: This policy is a guide, not a guarantee of any specific sequence. Alamo Prime reserves the right to skip steps or proceed directly to termination for serious violations.

---

## Progressive Discipline Steps

For most performance and conduct issues, we follow a progressive approach:

### Step 1: Verbal Warning
- Manager addresses the issue directly with the team member
- The concern is documented in the manager's log
- Clear expectations are set with a timeline for improvement
- Team member acknowledges the conversation

### Step 2: Written Warning
- Issued for repeated issues after a verbal warning, or for more serious first-time violations
- Both the manager and team member sign the written warning
- A copy is kept in the team member's file
- A specific improvement plan is outlined

### Step 3: Final Written Warning / Suspension
- Issued when previous warnings have not resulted in improvement
- May include unpaid suspension (1–3 days) to allow for reflection
- Team member is notified that termination is the next step
- A Performance Improvement Plan (PIP) may be required

### Step 4: Termination
- Employment is ended when improvement has not occurred after previous steps
- Exit interview is offered
- All company property must be returned on the last day

---

## Immediate Termination Offenses

The following violations may result in **immediate termination** without prior warning:

- Theft (of money, product, or property)
- Physical violence or threats against any person
- Sexual harassment or assault
- Intoxication or being under the influence of drugs while on duty
- Gross insubordination or threatening a manager
- Falsifying records or timekeeping
- Serious health code violations
- Unauthorized disclosure of confidential information
- No-call/no-show on two or more occasions

---

## Documentation

All disciplinary actions are documented and kept confidential in the team member's personnel file. Documentation includes:

- Date and description of the incident
- The policy or standard violated
- Prior warnings (if applicable)
- The corrective action taken
- Team member's acknowledgment or rebuttal (if provided)

---

## Your Rights

- You have the right to know what policy you violated
- You have the right to share your perspective before formal action is taken
- You may request a copy of any written warning you receive
- You may appeal a disciplinary decision to the General Manager within 5 business days
$MD$
WHERE slug = 'disciplinary-policy';

UPDATE public.manual_sections
SET content_es = $MD$
# Política Disciplinaria

Alamo Prime está comprometido a mantener un ambiente de trabajo profesional, seguro y de alto desempeño. Cuando la conducta o el desempeño están por debajo de las expectativas, seguimos un proceso disciplinario justo y consistente.

> **ℹ️ Nota**: Esta política es una guía, no una garantía de ninguna secuencia específica. Alamo Prime se reserva el derecho de omitir pasos o proceder directamente a la terminación por violaciones graves.

---

## Pasos de Disciplina Progresiva

Para la mayoría de los problemas de desempeño y conducta, seguimos un enfoque progresivo:

### Paso 1: Advertencia Verbal
- El gerente aborda el problema directamente con el miembro del equipo
- La preocupación se documenta en el registro del gerente
- Se establecen expectativas claras con un plazo para mejorar
- El miembro del equipo reconoce la conversación

### Paso 2: Advertencia Escrita
- Se emite por problemas repetidos después de una advertencia verbal, o por violaciones más graves por primera vez
- El gerente y el miembro del equipo firman la advertencia escrita
- Se guarda una copia en el expediente del miembro del equipo
- Se detalla un plan de mejora específico

### Paso 3: Advertencia Escrita Final / Suspensión
- Se emite cuando las advertencias previas no han resultado en mejora
- Puede incluir suspensión sin goce de sueldo (1–3 días) para reflexión
- Se notifica al miembro del equipo que la terminación es el siguiente paso
- Puede requerirse un Plan de Mejora de Desempeño (PIP)

### Paso 4: Terminación
- El empleo finaliza cuando no ha habido mejora después de los pasos anteriores
- Se ofrece una entrevista de salida
- Toda la propiedad de la empresa debe ser devuelta el último día

---

## Faltas que Resultan en Terminación Inmediata

Las siguientes violaciones pueden resultar en **terminación inmediata** sin advertencia previa:

- Robo (de dinero, producto o propiedad)
- Violencia física o amenazas contra cualquier persona
- Acoso o agresión sexual
- Intoxicación o estar bajo la influencia de drogas durante el servicio
- Insubordinación grave o amenazar a un gerente
- Falsificación de registros o control de tiempo
- Violaciones graves al código de salud
- Divulgación no autorizada de información confidencial
- No aviso / no presentarse en dos o más ocasiones

---

## Documentación

Todas las acciones disciplinarias se documentan y se mantienen confidenciales en el expediente de personal del miembro del equipo. La documentación incluye:

- Fecha y descripción del incidente
- La política o estándar violado
- Advertencias previas (si aplica)
- La acción correctiva tomada
- El reconocimiento o refutación del miembro del equipo (si se proporcionó)

---

## Tus Derechos

- Tienes derecho a saber qué política violaste
- Tienes derecho a compartir tu perspectiva antes de que se tome una acción formal
- Puedes solicitar una copia de cualquier advertencia escrita que recibas
- Puedes apelar una decisión disciplinaria al Gerente General dentro de los 5 días hábiles
$MD$
WHERE slug = 'disciplinary-policy';

COMMIT;
