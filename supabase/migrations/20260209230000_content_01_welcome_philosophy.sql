-- ============================================
-- CONTENT: 01 Welcome Philosophy (EN + ES)
-- Target slug: welcome-philosophy
-- Source files:
--   01-welcome-philosophy-sql-only.md
--   01-bienvenida-filosofia-sql-only.md
-- ============================================

BEGIN;

-- English content
UPDATE manual_sections
SET content_en = $MD$
# Welcome Philosophy

## Welcome to Alamo Prime

**Food, Beverage and Ambiance Excellence** — You are here because we believe you can make a meaningful contribution to our Culture and Brand.

### The Pursuit of Excellence

Whether it's the joy of cooking delicious food, crafting a flawless cocktail, pairing the perfect wine, or sharing timeless memories with our guests — this unites us through *hospitality*. The shared satisfaction in serving our guests while continuously honing our skills and mastering our craft will make **Alamo Prime F&B** an industry leader.

> **💡 Your Journey**: Your commitment to excellence starts today. Every interaction matters.

We are beyond excited to walk this journey with you and cannot wait to see how we grow together!

---

## Our Philosophy

### Core Beliefs

At Alamo Prime, we believe that excellence is not just a goal—it's our standard. Every interaction, every dish, every moment is an opportunity to create something exceptional. Our philosophy is built on three fundamental principles:

#### **1. Craftsmanship in Everything We Do**
- **Food Excellence**: Every dish is a masterpiece, prepared with passion, precision, and the finest ingredients
- **Beverage Artistry**: Every drink tells a story, crafted with skill, creativity, and attention to detail
- **Ambiance Perfection**: Every space creates an experience, designed with intention, comfort, and elegance

#### **2. Hospitality as Our Language**
- **Service Excellence**: We don't just serve food—we create experiences
- **Guest-Centric Approach**: Every decision begins and ends with our guests' satisfaction
- **Anticipatory Service**: We don't just meet expectations—we exceed them before they're even formed

#### **3. Community as Our Foundation**
- **Team Collaboration**: Our strength lies in our unity and mutual support
- **Guest Relationships**: We're not just a restaurant—we're part of our guests' lives
- **Community Engagement**: We're committed to being a positive force in our neighborhood

---

## Our Culture

### The Alamo Prime Way

Our culture is the invisible force that guides everything we do. It's how we treat each other, our guests, and our craft. It's the difference between being good and being unforgettable.

#### **We Lead with Hospitality**
- Every team member is a host first, regardless of position
- We greet every guest as if they're coming to our home
- We solve problems with grace and professionalism
- We create moments, not just transactions

#### **We Pursue Excellence Relentlessly**
- Good enough is never good enough
- We learn continuously and improve constantly
- We take pride in every detail, no matter how small
- We celebrate our successes and learn from our mistakes

#### **We Support Each Other Unconditionally**
- We succeed as a team or we don't succeed at all
- We help each other grow, learn, and advance
- We communicate with honesty, respect, and kindness
- We create an environment where everyone can thrive

#### **We Honor Our Craft**
- We respect the ingredients, the techniques, and the traditions
- We innovate while respecting the foundations
- We take pride in our knowledge and skills
- We share our passion with our guests and each other

---

## Our Commitment

### To Our Guests

We promise to provide an exceptional experience every time you visit Alamo Prime. This means:

- **Consistent Excellence**: The same high standards, every visit, every time
- **Authentic Hospitality**: Genuine care and attention to your comfort and satisfaction
- **Culinary Excellence**: Food that delights, surprises, and satisfies
- **Beverage Mastery**: Drinks that complement, enhance, and elevate
- **Ambiance Perfection**: An environment that welcomes, comforts, and inspires

### To Our Team

We promise to provide an environment where you can grow, thrive, and build a career. This means:

- **Professional Development**: Opportunities to learn, grow, and advance
- **Supportive Environment**: A workplace where you feel valued and respected
- **Work-Life Balance**: Schedules and practices that respect your personal life
- **Fair Compensation**: Recognition and rewards for your contributions
- **Career Pathways**: Clear opportunities for advancement and growth

### To Our Community

We promise to be a positive force in our neighborhood. This means:

- **Local Sourcing**: Supporting local farmers, producers, and businesses
- **Community Engagement**: Participating in and supporting local initiatives
- **Environmental Responsibility**: Sustainable practices that protect our planet
- **Economic Contribution**: Creating jobs and supporting the local economy
- **Cultural Enrichment**: Being a destination that enhances our community

---

## Our Standards

### The Alamo Prime Standard

Everything we do is measured against one simple question: "Is this excellent?" If the answer is no, we haven't finished yet.

#### **Food Standards**
- **Freshness**: Only the freshest, highest-quality ingredients
- **Technique**: Proper preparation methods executed with precision
- **Presentation**: Beautiful, appetizing, and consistent plating
- **Flavor**: Balanced, memorable, and satisfying taste profiles
- **Consistency**: The same exceptional quality, every single time

#### **Service Standards**
- **Timeliness**: Prompt, efficient, and well-paced service
- **Knowledge**: Deep understanding of our menu, ingredients, and processes
- **Attitude**: Warm, genuine, and professional interactions
- **Problem-Solving**: Graceful handling of any issues or concerns
- **Personalization**: Tailored experiences that recognize individual preferences

#### **Environment Standards**
- **Cleanliness**: Immaculate spaces, from front of house to back of house
- **Ambiance**: Perfect lighting, temperature, music, and atmosphere
- **Comfort**: Thoughtful design that enhances the dining experience
- **Maintenance**: Well-maintained facilities and equipment
- **Safety**: Complete compliance with all health and safety regulations

---

## Our Promise

### The Alamo Prime Guarantee

We stand behind everything we do. If for any reason your experience doesn't meet our standards of excellence, we want to know immediately. We will make it right, no questions asked.

### Our Invitation

We invite you to become part of the Alamo Prime family—whether as a guest, a team member, or a community partner. Together, we can create something truly special.

### Our Vision

We envision Alamo Prime as more than a restaurant—we see it as a destination where:
- **Memories are made** and stories are shared
- **Careers are built** and dreams are realized
- **Community thrives** and connections are formed
- **Excellence lives** in every detail and interaction

---

## Join Our Journey

### For Our Guests

Thank you for choosing Alamo Prime. We're honored to be part of your special moments and look forward to serving you with excellence, passion, and genuine hospitality.

### For Our Team Members

> **🚀 Welcome**: Welcome to the Alamo Prime family. We're thrilled to have you with us and can't wait to see the incredible things we'll accomplish together. Your journey starts now.

### For Our Community

Thank you for your support. We're proud to be part of this community and committed to being a positive force for good.

---

**At Alamo Prime, excellence isn't just what we do—it's who we are. Every day, in every way, we strive to be better than we were yesterday, because our guests, our team, and our community deserve nothing less.** 🌟

*Welcome to Alamo Prime—where excellence meets hospitality, and every moment is an opportunity to create something extraordinary.*
$MD$,
    word_count_en = 2000,
    updated_at = now()
WHERE slug = 'welcome-philosophy';

-- Spanish content (slug corrected from 'filosofia-bienvenida' to 'welcome-philosophy')
UPDATE manual_sections
SET content_es = $MD$
# Filosofía de Bienvenida

## Bienvenidos a Alamo Prime

**Excelencia en Comida, Bebida y Ambiente** - Estás aquí porque creemos que puedes hacer una contribución significativa a nuestra Cultura y Marca.

### La Búsqueda de la Excelencia

Ya sea la alegría de cocinar comida deliciosa, crear un cóctel impecable, emparejar el vino perfecto o compartir recuerdos atemporales con nuestros huéspedes — esto nos une a través de la hospitalidad. La satisfacción compartida de servir a nuestros huéspedes mientras continuamente perfeccionamos nuestras habilidades y dominamos nuestro oficio hará que **Alamo Prime F&B** sea un líder en la industria.

> **💡 Tu Viaje**: Tu compromiso con la excelencia comienza hoy. Cada interacción importa.

Estamos más que emocionados de caminar este viaje con ustedes y no podemos esperar para ver cómo crecemos juntos.

---

## Nuestra Filosofía

### Creencias Fundamentales

En Alamo Prime, creemos que la excelencia no es solo una meta—es nuestro estándar. Cada interacción, cada plato, cada momento es una oportunidad para crear algo excepcional. Nuestra filosofía está construida sobre tres principios fundamentales:

#### **1. Artesanía en Todo lo Que Hacemos**
- **Excelencia en Comida**: Cada plato es una obra maestra, preparada con pasión, precisión y los mejores ingredientes
- **Artesanía de Bebidas**: Cada bebida cuenta una historia, elaborada con habilidad, creatividad y atención al detalle
- **Perfección del Ambiente**: Cada espacio crea una experiencia, diseñada con intención, comodidad y elegancia

#### **2. Hospitalidad como Nuestro Lenguaje**
- **Excelencia en Servicio**: No solo servimos comida—creamos experiencias
- **Enfoque Centrado en el Huésped**: Cada decisión comienza y termina con la satisfacción de nuestros huéspedes
- **Servicio Anticipatorio**: No solo cumplimos expectativas—las superamos antes de que se formen

#### **3. Comunidad como Nuestro Fundamento**
- **Colaboración de Equipo**: Nuestra fuerza radica en nuestra unidad y apoyo mutuo
- **Relaciones con Huéspedes**: No solo somos un restaurante—somos parte de la vida de nuestros huéspedes
- **Compromiso Comunitario**: Estamos comprometidos a ser una fuerza positiva en nuestro vecindario

---

## Nuestra Cultura

### La Manera Alamo Prime

Nuestra cultura es la fuerza invisible que guía todo lo que hacemos. Es cómo nos tratamos unos a otros, a nuestros huéspedes y a nuestro oficio. Es la diferencia entre ser buenos y ser inolvidables.

#### **Lideramos con Hospitalidad**
- Cada miembro del equipo es un anfitrión primero, sin importar la posición
- Saludamos a cada huésped como si vinieran a nuestro hogar
- Resolvemos problemas con gracia y profesionalismo
- Creamos momentos, no solo transacciones

#### **Persiguiendo la Excelencia Implacablemente**
- Suficientemente bueno nunca es suficientemente bueno
- Aprendemos continuamente y mejoramos constantemente
- Nos enorgullecemos de cada detalle, sin importar cuán pequeño
- Celebramos nuestros éxitos y aprendemos de nuestros errores

#### **Nos Apoyamos Incondicionalmente**
- Tenemos éxito como equipo o no tenemos éxito en absoluto
- Nos ayudamos unos a otros a crecer, aprender y avanzar
- Nos comunicamos con honestidad, respeto y amabilidad
- Creamos un ambiente donde todos pueden prosperar

#### **Honramos Nuestro Oficio**
- Respetamos los ingredientes, las técnicas y las tradiciones
- Innovamos mientras respetamos los fundamentos
- Nos enorgullecemos de nuestro conocimiento y habilidades
- Compartimos nuestra pasión con nuestros huéspedes y unos a otros

---

## Nuestro Compromiso

### Para Nuestros Huéspedes

Prometemos proporcionar una experiencia excepcional cada vez que visiten Alamo Prime. Esto significa:

- **Excelencia Consistente**: Los mismos altos estándares, cada visita, cada vez
- **Hospitalidad Auténtica**: Cuidado y atención genuinos a tu comodidad y satisfacción
- **Excelencia Culinaria**: Comida que deleita, sorprende y satisface
- **Dominio de Bebidas**: Bebidas que complementan, mejoran y elevan
- **Perfección del Ambiente**: Un entorno que acoge, conforta e inspira

### Para Nuestro Equipo

Prometemos proporcionar un ambiente donde puedas crecer, prosperar y construir una carrera. Esto significa:

- **Desarrollo Profesional**: Oportunidades de aprender, crecer y avanzar
- **Ambiente de Apoyo**: Un lugar de trabajo donde te sientes valorado y respetado
- **Equilibrio Trabajo-Vida**: Horarios y prácticas que respetan tu vida personal
- **Compensación Justa**: Reconocimiento y recompensas por tus contribuciones
- **Caminos de Carrera**: Oportunidades claras de avance y crecimiento

### Para Nuestra Comunidad

Prometemos ser una fuerza positiva en nuestro vecindario. Esto significa:

- **Abastecimiento Local**: Apoyar a agricultores locales, productores y negocios
- **Compromiso Comunitario**: Participar y apoyar iniciativas locales
- **Responsabilidad Ambiental**: Prácticas sostenibles que protegen nuestro planeta
- **Contribución Económica**: Crear empleos y apoyar la economía local
- **Enriquecimiento Cultural**: Ser un destino que mejora nuestra comunidad

---

## Nuestros Estándares

### El Estándar Alamo Prime

Todo lo que hacemos se mide contra una pregunta simple: "¿Es esto excelente?" Si la respuesta es no, no hemos terminado.

#### **Estándares de Comida**
- **Frescura**: Solo los ingredientes más frescos y de la más alta calidad
- **Técnica**: Métodos de preparación apropiados ejecutados con precisión
- **Presentación**: Emplatado hermoso, apetitoso y consistente
- **Sabor**: Perfiles de sabor equilibrados, memorables y satisfactorios
- **Consistencia**: La misma calidad excepcional, cada vez

#### **Estándares de Servicio**
- **Oportunidad**: Servicio rápido, eficiente y bien ritmado
- **Conocimiento**: Comprensión profunda de nuestro menú, ingredientes y procesos
- **Actitud**: Interacciones cálidas, genuinas y profesionales
- **Resolución de Problemas**: Manejo elegante de cualquier problema o preocupación
- **Personalización**: Experiencias adaptadas que reconocen preferencias individuales

#### **Estándares de Ambiente**
- **Limpieza**: Espacios impecables, desde la sala hasta la cocina
- **Ambiente**: Iluminación, temperatura, música y atmósfera perfectas
- **Comodidad**: Diseño cuidadoso que mejora la experiencia gastronómica
- **Mantenimiento**: Instalaciones y equipo bien mantenidos
- **Seguridad**: Cumplimiento completo con todas las regulaciones de salud y seguridad

---

## Nuestra Promesa

### La Garantía Alamo Prime

Nos respaldamos todo lo que hacemos. Si por alguna razón tu experiencia no cumple con nuestros estándares de excelencia, queremos saberlo inmediatamente. Lo haremos bien, sin preguntas.

### Nuestra Invitación

Te invitamos a ser parte de la familia Alamo Prime—ya sea como huésped, miembro del equipo o socio comunitario. Juntos, podemos crear algo verdaderamente especial.

### Nuestra Visión

Visualizamos Alamo Prime como más que un restaurante—lo vemos como un destino donde:
- **Los recuerdos se crean** y las historias se comparten
- **Las carreras se construyen** y los sueños se realizan
- **La comunidad prospera** y las conexiones se forman
- **La excelencia vive** en cada detalle e interacción

---

## Únete a Nuestro Viaje

### Para Nuestros Huéspedes

Gracias por elegir Alamo Prime. Estamos honrados de ser parte de tus momentos especiales y esperamos servirte con excelencia, pasión y hospitalidad genuina.

### Para Nuestros Miembros del Equipo

> **🚀 Bienvenida**: Bienvenidos a la familia Alamo Prime. Estamos emocionados de tenerte con nosotros y no podemos esperar para ver las cosas increíbles que lograremos juntos. Tu viaje comienza ahora.

### Para Nuestra Comunidad

Gracias por tu apoyo. Estamos orgullosos de ser parte de esta comunidad y comprometidos a ser una fuerza positiva para el bien.

---

**En Alamo Prime, la excelencia no es solo lo que hacemos—es quiénes somos. Cada día, en cada forma, nos esforzamos por ser mejores que ayer, porque nuestros huéspedes, nuestro equipo y nuestra comunidad no merecen nada menos.** 🌟

*Bienvenidos a Alamo Prime—donde la excelencia se encuentra con la hospitalidad, y cada momento es una oportunidad para crear algo extraordinario.*
$MD$,
    word_count_es = 3500,
    updated_at = now()
WHERE slug = 'welcome-philosophy';

COMMIT;
