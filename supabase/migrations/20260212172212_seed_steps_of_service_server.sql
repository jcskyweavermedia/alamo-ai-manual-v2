-- =============================================================================
-- MIGRATION: seed_steps_of_service_server
-- Inserts 29 sections for the Server position at Alamo Prime
-- Phase 2 of Steps of Service Viewer
-- =============================================================================

DO $$
DECLARE
  v_group_id UUID;
  v_user_id  UUID := 'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4';
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 1: Welcome & Mission  (sort 10)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'welcome', NULL, 10,
    'Welcome & Mission',
    'Bienvenida y Misión',
    'Welcome to our Serving Team!

Your mission is to provide our guests with a **memorable, personalized experience** through exceptional team service, exercising all of Alamo Prime Steakhouse''s standards and procedures.

- **Every guest is your guest.** Every table is your table.
- If you anticipate that a guest or team member needs something, it is **your responsibility** to do anything and everything to fulfill their needs.
- We have built a reputation for exceeding our guests'' expectations.

At Alamo Prime, our hospitality philosophy is to provide an **outstanding, refined, and tailored experience** to each and every one of our guests.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 2: Primary Responsibilities  (sort 20)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'primary-responsibilities', NULL, 20,
    'Primary Responsibilities',
    'Responsabilidades Principales',
    'Your primary responsibilities include:

- **Arrive for your shift on time**, in proper uniform, prepared with all your tools and knowledge, ready to work
- **Determine your station** for the evening and detail it thoroughly
- **Teamwork is key** in delivering the Alamo Prime experience — always act professional
- **Adhere to all policies and procedures** of Alamo Prime Steakhouse

> **Best Practice**: Being 15 minutes early is being on time!',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 3: What is a Prime Steakhouse?  (sort 30)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'prime-steakhouse', NULL, 30,
    'What is a Prime Steakhouse?',
    '¿Qué es un Prime Steakhouse?',
    'A **prime steakhouse** is an establishment that dedicates itself to serving the highest-quality cuts of beef and accompaniments in an upscale, refined dining setting.

A prime steakhouse takes classic American steakhouse traditions and **elevates them to a superior level**, creating an exceptional and memorable dining experience.

- A traditional restaurant focuses on *variety*
- A prime steakhouse focuses on **mastering the art of the perfect steak**, complemented by an outstanding beverage program and impeccable side dishes

Alamo Prime Steakhouse strives for **excellence in food, drinks, and service**, while providing a warm, sophisticated, and comfortable setting.

### Our Dining Philosophy

Alamo Prime believes in a **traditional coursed dining experience** within a warm and elegant atmosphere. We offer an expertly curated menu of premium steaks, fresh seafood, classic appetizers, and indulgent sides. This style of dining allows our guests to savor each course and enjoy the full progression of their meal.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 4: Guest Service Standards  (sort 40)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'guest-service-standards', NULL, 40,
    'Guest Service Standards',
    'Estándares de Servicio al Comensal',
    'You are our guests'' first contact with Alamo Prime, whether by phone or in person. **Greet every guest with a warm smile** and a friendly hello — even over the phone.

Our concept is based on warm, personal, and friendly service to create a refined and comfortable atmosphere. Be sure that everything you do reflects and promotes that principle.

- **Maintain eye contact** and a friendly smile whenever interacting with guests
- **Learn and use our guests'' names**
- **Recognize, greet, and seat** guests personally and professionally
- **Personalize the experience** by reading the chit — get to know our guests, know the menu, daily specials, signature cocktails, wine list, and bourbon selection
- **Anticipate needs** — offer what the guest wants before they ask, but never assume; if unsure, **ASK!**
- **Remain available at all times** — if you''re not available, you can''t provide first-class service
- **Guests always have the right of way** — move to the side, smile, make eye contact, and greet them
- **Lead guests to restrooms** — never just point or give verbal directions
- **Strive to do the right thing** — your actions reflect you and our entire team
- **Never take shortcuts** — doing things the right way yields better results

> **Best Practice**: The best servers in the industry share one major quality — **CONFIDENCE!** Exude confidence by:
>
> - **Know your product well!** Paint a picture for the guest. Know your cuts, temperatures, sides, and pairings. Keep the guest''s best interests in mind.
> - **Remain calm and in control**, no matter how busy or challenging things get. Like a duck in a pond — beautiful and elegant above water, paddling at 100 mph underneath where no one can see.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 5: Appearance & Uniforms  (sort 50)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'appearance-uniforms', NULL, 50,
    'Appearance & Uniforms',
    'Apariencia y Uniforme',
    '### Appearance

- Hair, facial hair, and nails must be clean and groomed
- No hair styles or hair color that may be deemed extreme
- Shower daily and use deodorant
- Do not use overwhelming cologne or perfume
- Use appropriate make-up
- No earrings

### Uniforms

- Black, polished non-slip shoes
- Black pants
- Black socks
- Black belt
- Clean and pressed apron
- Black undershirt
- Black and clean Henley shirt',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 6: Tools & Knowledge  (sort 60)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'tools-knowledge', NULL, 60,
    'Tools & Knowledge',
    'Herramientas y Conocimiento',
    'Make sure you have these items before every shift:

- Pens
- Wine key
- A bank (cash for making change)
- Check presenters
- Steak temperature card (for reference)

You must also **know the menu, cocktails, wine list, bourbon selection, and daily specials** inside and out.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 7: Dining Room Setup  (sort 70)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'dining-room', NULL, 70,
    'Dining Room Setup',
    'Preparación del Comedor',
    'Ensure your station is ready to go before service begins:

- **All tables and table bases** must be wiped down, clean, and free of chewing gum
- **Floors, chairs, and booths** must be completely cleaned and spotless
- **Steak knives** must be polished, spotless, and properly set at each place setting',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 8: Job Responsibilities  (sort 80)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'job-responsibilities', NULL, 80,
    'Job Responsibilities',
    'Responsabilidades del Puesto',
    'Your job responsibilities include, but are not limited to:

- Side work before, during, and at the end of your shift
- Opening the door and helping seat our guests
- Being at your station to greet guests as they are being seated
- Helping fellow team members greet their tables if they are unable to do so
- Having thorough knowledge of all products and menu items, including cuts, preparations, and temperatures
- Taking all orders (drinks, appetizers, entrées, sides, desserts) accurately and efficiently
- Serving all items according to our standards
- Guiding our guests through the menu
- Executing **all steps of service** with each guest to provide an excellent experience
- Anticipating guests'' needs
- Making eye contact while speaking to guests
- Keeping guests informed
- Always asking if you are in doubt
- Asking for help from team members or managers when needed
- **Always work as a team** — there is no place for individuals
- Maintaining your station clean at all times and resetting tables as soon as possible',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 9: Professionalism  (sort 90)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'professionalism', NULL, 90,
    'Professionalism',
    'Profesionalismo',
    'Carry yourself in a professional manner at all times. You represent not only yourself but our entire company. Make us proud!

### Eye Contact

An extremely important form of communication. It demonstrates **confidence and interest** in what is being said. You must **always** keep eye contact with the guest while interacting with them.

### Smile

A smile sets the tone. When you smile, everyone around you smiles as well. A smile is a **powerful tool** in setting the atmosphere and adding to a great guest experience.

### Body Language

A telling sign of how you are feeling. If guests see you standing straight and walking tall, it shows you are engaged and ready. If they see you leaning, hunched over, or walking with a slouch, they will think you are not engaged.

> **Remember**: If you''re having a good day — share it! If you''re having a bad day — be a professional and smile anyway.

### Tone of Voice

Your tone speaks volumes about how you feel. Watch your tone and ensure there are never any elements of unintended sarcasm. Keep your tone **soft, smooth, and pleasant** at all times.

### Position at the Table

Always position yourself **across from the guest** whenever possible, so they are not turning their neck uncomfortably to see you.

> **Best Practice**: When addressing a large group, project your voice and ensure you are addressing the entire table. Shifting from one side of the table to the other can prove useful and engaging.

### Language

Avoid unprofessional language. No slang or terms such as "you guys," "Hi guys," or "Wassup." Use professional vocabulary. Be relaxed — not stiff — but always be professional.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 10: Food Allergies & Intolerances  (sort 100)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'food-allergies', NULL, 100,
    'Food Allergies & Intolerances',
    'Alergias e Intolerancias Alimentarias',
    'Food allergies occur when the immune system mistakenly attacks a food protein. Ingestion of the offending food may trigger the sudden release of chemicals, resulting in symptoms of an allergic reaction. **A food allergy can be potentially fatal.**

### Symptoms

May include one or more of the following: tingling sensation in the mouth, swelling of the tongue and throat, difficulty breathing, hives, vomiting, abdominal cramps, diarrhea, drop in blood pressure, loss of consciousness, and even death. Symptoms typically appear within **minutes to two hours** after eating the allergen.

### Common Food Allergens

**Eight foods account for 90% of all food-allergic reactions:**

- Milk
- Eggs
- Peanuts
- Tree nuts
- Fish
- Shellfish
- Wheat
- Soy

### Food Intolerances

Food intolerances differ from allergies — the immune system is not involved. Two common intolerances:

**Lactose Intolerance** — The small intestine does not produce enough lactase enzyme to digest lactose (a sugar found in dairy products). Symptoms typically occur within 30 minutes to 2 hours after ingesting dairy.

**Celiac Disease** — An adverse reaction to gluten, found in wheat, rye, barley, and possibly oats. Requires a **lifelong restriction** of gluten. Symptoms include bloating, gas, diarrhea, constipation, headaches, itchy skin rash, and pale mouth sores.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 11: Warm Welcome & Seating  (sort 110)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'warm-welcome', NULL, 110,
    'Warm Welcome & Seating',
    'Bienvenida y Acomodo del Comensal',
    'Everyone may be called upon to help seat guests when necessary. As a server, you must learn and understand how to seat guests properly.

- **When a guest arrives**, always make eye contact, smile, greet, and welcome them. If you have the opportunity, open the door.
- **Whenever possible**, greet guests by their name.
- The host will hand the seater a **chit** with the guest''s name and notes (special occasions, etc.).
- If guests are carrying beverages or personal items, **offer to assist them** to their table.
- **Strike up a conversation** while guiding them at a slow and steady pace.
- When seating a guest, **pull out their chair** if possible (ladies first).
- **Always place menus in the guest''s hands.**

### The Quick Intro (10-12 seconds)

Always explain the daily specials, beverage and bourbon selections, and happy hour (if applicable). This should not take more than 10-12 seconds.

> *Server*: "This is our menu, featuring premium cuts of beef, fresh seafood, and classic steakhouse appetizers. We also have our daily specials, which the Chef prepares fresh. Our beverage menu includes an extensive bourbon and whiskey collection, a curated wine list, and handcrafted cocktails. Enjoy your evening!"

> *Server*: "The Chef has prepared some wonderful specials this evening, which you''ll find on the insert. We also have an outstanding bourbon collection, a world-class wine list, and signature cocktails. Enjoy!"

> **Best Practice**: There will be times where you will have to assist the hostess seat tables. Make sure you understand all of the steps above so you can be ready at all times!',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 12: Transferring Checks  (sort 120)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'transferring-checks', NULL, 120,
    'Transferring Checks',
    'Transferencia de Cuentas',
    'Guests may begin their dining experience at the bar and then move to the dining room. When this happens, they may want to **transfer their check** from the bar to their table.

- Our guests are allowed to transfer their checks
- The **bartender is responsible** for initiating the transfer
- It is **your job to ensure** the transfer is performed
- When you become aware a check needs to be transferred, **seek out any manager** and have them transfer the check',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 13: First Approach — The Greeting  (sort 130, PARENT)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'first-approach', NULL, 130,
    'First Approach — The Greeting',
    'Primer Acercamiento — El Saludo',
    'The greeting has several parts that must be covered:

1. **Name & Introduction** — Greet, identify special occasions, first-time vs. returning guest
2. **Beverage Order** — Cocktail, bourbon, wine, or other drink preferences
3. **Water Type** — Regular or bottled, still or sparkling
4. **Appetizer Mention** — Read the guest, suggest 2-3 starters',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 14: Name & Introduction  (sort 131, CHILD of first-approach)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'first-approach-intro', 'first-approach', 131,
    'Name & Introduction',
    'Nombre e Introducción',
    'Your introduction sets the tone for the entire dining experience. Cover these key points:

### Address the Guest

- Use the guest''s last name (from the seating chit)
- If you cannot pronounce their name, ask for help — if in doubt, don''t use it
- Acknowledge any special occasions: *"Congratulations, Mr. Smith! Happy Birthday!"*
- Ask if this is anyone''s first time at the restaurant

### First-Time Guests

All new guests need to be informed about:

1. **We are a prime steakhouse** featuring the finest cuts of beef and an exceptional dining experience
2. **Our menu is coursed** — appetizers, entrées with your choice of sides, and desserts
3. **Our steaks are hand-selected, aged, and cooked to your preferred temperature** — our Chef takes great pride in every cut
4. **We feature an outstanding bourbon and whiskey program**, along with a curated wine list

> *Server*: "Welcome to Alamo Prime, Mr. Smith! It''s a pleasure to have you here. Is this your first time dining with us?"
>
> *Guest*: "Actually, it is!"
>
> *Server*: "That''s wonderful! We are a prime steakhouse and our menu features hand-selected cuts of beef, fresh seafood, and classic steakhouse appetizers. Your meal will be coursed — we''ll start you with appetizers, then move to your entrée with your choice of sides, and finish with dessert if you''d like. We also have an exceptional bourbon and whiskey collection."

> *Server*: "Mr. Garcia, thank you for choosing Alamo Prime. You are in for a treat! Have you ever dined with us before?"
>
> *Guest*: "No, this is my first time."
>
> *Server*: "Wonderful. We are a prime steakhouse featuring the finest cuts of beef, all hand-selected and aged. Our menu is coursed — we''ll begin with appetizers, move to your steak or entrée with your choice of premium sides, and wrap up with dessert. Our Chef takes incredible care with every dish, and we have a bourbon collection that is truly second to none."

### Returning Guests

- Welcome them back and thank them for choosing Alamo Prime again
- Proceed directly to the beverage order

> **Best Practice**: Infuse the greeting with your own personality. Always cover the main points, but find new ways of delivering the message. Practice your spiel, listen to how others do it, and develop a style that suits you. The best servers always learn from others. Also, ask your guests if they are in a hurry to catch a show or other engagement.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 15: Beverage Order  (sort 132, CHILD of first-approach)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'first-approach-beverage', 'first-approach', 132,
    'Beverage Order',
    'Orden de Bebidas',
    'Ask the guests if they are interested in a cocktail, bourbon, or wine to start the evening.

> *Server*: "May I interest you in a cocktail or a glass of wine to start the evening?"
>
> *Server*: "Would you like to explore our bourbon collection, or perhaps a handcrafted cocktail?"
>
> *Server*: "Do you care for a glass of wine, or perhaps one of our signature cocktails?"

### Directing to the Menu

Always direct the guests to the beverage menu as you make a suggestion:

> *Guest*: "I would like a cocktail."
>
> *Server*: "Here is our beverage menu *(open and point at the cocktail page)*. Our Smoked Old Fashioned is a guest favorite — it''s made with premium bourbon, a touch of maple, and a hint of smoke. Another excellent choice is our Espresso Martini, which is smooth and absolutely delicious!"

### Reading the Guest

Try to determine what the guest likes, and offer **two suggestions** based on that:

> *Guest*: "A cocktail sounds good! Can I see your cocktail list?"
>
> *Server*: "Absolutely! Here is our beverage menu. Do you enjoy bourbon or whiskey?"
>
> *Guest*: "I do!"
>
> *Server*: "You''ll love our Smoked Old Fashioned *(pointing at the menu)* — it''s our most popular cocktail. If you prefer something with a bit more kick, our Spicy Manhattan is made with rye whiskey and a touch of jalapeño honey. It''s outstanding!"

### Off-Menu Requests

If the guest prefers a specific cocktail not on the list, always ask if they have a liquor preference. If after 2 seconds the guest does not respond, suggest two options.

> *Guest*: "I would like a whiskey sour."
>
> *Server*: "Do you have a bourbon preference?" *(Pause 2 seconds...)* "Do you care for Woodford Reserve or Maker''s Mark?"

> **Best Practice**: Never use the word "well liquors" — always say **"our house liquors."** We do not use low-quality liquors, and we want to portray this in our verbiage. Also, if a guest asks for well liquor, they want the cheapest brand you have. Always know which brand is part of our house liquors. House liquors are the lowest in price.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 16: Water Type  (sort 133, CHILD of first-approach)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'first-approach-water', 'first-approach', 133,
    'Water Type',
    'Tipo de Agua',
    'Ask guests for their water preference: **regular or bottled**. If bottled, determine if they prefer **still or sparkling**.

Our regular water is filtered at the restaurant.

> *Server*: "Do you care for regular or bottled water this evening?"
>
> *Guest*: "Bottled, please."
>
> *Server*: "Sure, do you care for still or sparkling?"',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 17: Appetizer Mention  (sort 134, CHILD of first-approach)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'first-approach-appetizer', 'first-approach', 134,
    'Appetizer Mention',
    'Mención de Aperitivos',
    '**Read your guests** and determine if you can proceed with the appetizer mention. Some guests are very interested in talking to one another, others are in business meetings. But many of our guests are food enthusiasts and love to hear suggestions.

Ask the guests if they would like to hear appetizer suggestions. If they do, point out **2-3 selections** from the menu.

> *Server*: "We have an excellent selection of appetizers and some phenomenal seafood starters. May I make a suggestion?"
>
> *Guest*: "I need a couple of minutes."
>
> *Server*: "No problem, I will be right back with your Old Fashioned."

> *Server*: "To start, we have some outstanding appetizers. May I make a recommendation?"
>
> *Guest*: "Sounds good!"
>
> *Server*: "Our Shrimp Cocktail is a guest favorite — four jumbo shrimp served chilled with our house-made cocktail sauce. If you''re looking for something a bit heartier, our Wedge Salad is a classic — crisp iceberg lettuce, applewood smoked bacon, blue cheese crumbles, and cherry tomatoes. Would you like to start with either of those?"

> **Best Practice**: When making an appetizer recommendation, always ask if the guest would like to order one of your selections or perhaps try something else. Don''t just offer suggestions and then run away to get the drinks — take the order!',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 18: Second Approach  (sort 140)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'second-approach', NULL, 140,
    'Second Approach — Beverage Delivery & Entrée Presentation',
    'Segundo Acercamiento — Entrega de Bebidas y Presentación del Plato Fuerte',
    '### Beverage Delivery

- **All beverages must be delivered on a tray.** If there are no trays — go get some!
- Always serve **ladies first**
- All beverages (except stemware) must be served with a **cocktail napkin** underneath
- Drinks should be served within **3 to 5 minutes** of being ordered
- Drinks should be **delivered by name**
- All labels of any bottle product must **face the guest**
- Present the steak knife selection or butter board at the appropriate time, per house standards

### Entrée Presentation

Once all drinks have been delivered, make **2 to 3 recommendations**. At least one should be from the daily specials.

> *Server*: "If I may take a moment to share some highlights. The Chef has prepared some outstanding specials this evening. Tonight we are featuring a 22-ounce dry-aged bone-in ribeye, seasoned with our house blend and finished with herb butter — it is exceptional. From the regular menu, one of my personal favorites is our Filet Mignon. It''s an 8-ounce center-cut filet, incredibly tender, and pairs beautifully with our Creamed Spinach or Truffle Mac & Cheese. It''s an outstanding combination!"

Once the recommendations are made, always ask if they have questions or are ready to order:

> *Server*: "Do you have any questions about the menu? Would you like me to take your order?"
>
> *Server*: "Are there any questions I may answer for you? Are you ready to order?"',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 19: Taking the Order  (sort 150)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'taking-the-order', NULL, 150,
    'Taking the Order',
    'Toma de la Orden',
    'Once your guests are ready to order, have your chit and pen ready. Begin with ladies first, if possible.

**You must REPEAT the ORDER back to each guest individually.** This ensures accuracy. Do not repeat the order to the entire table as a group — that is not the upscale way. Take one person''s order, repeat it back immediately, then move to the next guest.

### Steak Orders

When taking steak orders, always confirm:

1. **The cut and size** (e.g., 12 oz New York Strip)
2. **The desired temperature**
3. **Any additions or toppings** (blue cheese crust, peppercorn sauce, sautéed mushrooms, etc.)
4. **Their choice of sides**

### Steak Temperatures

| Temperature | Description |
|-------------|-------------|
| Rare | Cool red center |
| Medium Rare | Warm red center *(our most popular)* |
| Medium | Warm pink center |
| Medium Well | Slight hint of pink |
| Well Done | No pink, cooked through |

If a guest is unsure about a temperature, describe them clearly using the table above.

> **Best Practice**: Repeat the order to each guest individually right after they finish ordering. Do not wait and repeat to the group.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 20: Coursing Explained  (sort 160)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'coursing', NULL, 160,
    'Coursing Explained',
    'Explicación del Coursing',
    'At Alamo Prime, all meals follow a **traditional coursed dining format**. This allows each course to be enjoyed fully before the next arrives, and enables our kitchen to execute each dish with care and precision.

### How Coursing Works

Your job is to guide the guest through their meal in a logical progression — appetizers first, then entrées with sides, and finally desserts. The coursing method ensures guests are never overwhelmed and every dish arrives at its peak.

### Rules for Coursing

1. **Appetizer Course**: All appetizer orders are rung in first. Cold appetizers (shrimp cocktail, oysters, wedge salad) fire immediately. Hot appetizers (crab cakes, bacon-wrapped scallops) follow shortly after.
2. **Explain the progression** to your guests so they understand the coursing method. Handle any objections with good judgment.
3. **Never overwhelm the table** — entrées should never be delivered while appetizer plates are still on the table.
4. **Entrée Course**: Once appetizers are cleared, fire the entrée course. All steak and entrée orders for the table should fire at the same time so the entire table is served together.
5. **Side Dishes**: Delivered alongside the entrée course. Ensure all sides arrive at the same time as the steaks.
6. **Dessert Course**: Only after the entrée course has been fully cleared and the table has been crumbed should you present the dessert menu or make recommendations.
7. **Proper utensils**: Always ensure each place setting has the proper utensils for the course being served.

> **Best Practice**: Use common sense when coursing. If two guests order appetizers and one does not, ring in the appetizers and hold entrées until the appetizer course is cleared. The goal is that the entire table moves through the meal together.

### Coursing Example

A table of 3 orders the following:

**First Course (Appetizers):**
- Shrimp Cocktail
- Wedge Salad
- French Onion Soup

**Second Course (Entrées & Sides):**
- 12 oz New York Strip (medium rare) with Creamed Spinach
- 8 oz Filet Mignon (medium) with Truffle Mac & Cheese
- 16 oz Bone-In Ribeye (medium rare) with Loaded Baked Potato

**Third Course (Desserts):**
- Chocolate Lava Cake
- New York Cheesecake

The first course arrives while appetites are fresh. The second course — the main event — is delivered all at once so every guest eats together. The third course is served only after the entrée course is fully cleared and the table is crumbed and reset.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 21: Food Delivery Times  (sort 170)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'food-delivery-times', NULL, 170,
    'Food Delivery Times',
    'Tiempos de Entrega',
    'Standard delivery times to the table:

| Course | Expected Time |
|--------|---------------|
| Appetizers | 5 to 10 minutes |
| Entrées & Steaks | 12 to 18 minutes *(depending on temperature and cut)* |
| Desserts | 4 to 8 minutes |

These are guidelines — actual times may vary. Keep your guests informed if there are any delays.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 22: Pre-bussing & Table Maintenance  (sort 180)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'prebussing', NULL, 180,
    'Pre-bussing & Table Maintenance',
    'Pre-bussing y Mantenimiento de Mesa',
    'Maintaining a clean and organized table throughout the meal is essential:

- **Clear plates and utensils** between courses as necessary, and replace them
- **Remove all crumbs** — make sure plates are clean and dry
- **Refill beverages** — refill sodas, teas, and water when below half the glass
- **Dessert prep** — ensure the table is cleaned, crumbed, and pre-bussed before desserts arrive. Always bring appropriate dessert utensils (forks and spoons)
- **Fold napkins** — when a guest leaves the table for any reason, take their napkin, fold it, and place it where they are seated',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 23: The Check  (sort 190)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'the-check', NULL, 190,
    'The Check',
    'La Cuenta',
    'Follow these steps when presenting the check:

1. **Audit your check** to ensure everything has been rung in accurately
2. **Place the check** in a neutral position — make sure the check presenter is standing up with the spine facing the guest
3. **Inform guests** that you will pick up the check whenever they are ready
4. Once they offer payment, **return change or credit card receipt** as soon as possible
5. When returning the receipt, **draw attention to the email subscription card** and invite them to join — explain the benefits
6. **Thank your guests by name** and invite them to return',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 24: Service Do's and Don'ts  (sort 200)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'service-dos-donts', NULL, 200,
    'Service Do''s and Don''ts',
    'Lo Que Sí y Lo Que No del Servicio',
    'Key service rules to remember:

- **Serve food from the left**, remove from the right (whenever possible)
- **Serve beverages from a tray**, and to the right of the guest
- **Never reach across a guest** to serve or remove an item
- **Serve ladies first** whenever possible
- **Bottled products** (beer, wine, bottled water) — serve with the **label facing the guest**. When placing bottles on the table, labels face the guest
- **Replacement silverware** must always be delivered on linen
- **Always ask "May I remove?"** before removing anything from the table',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 25: Situations & Guest Issues  (sort 210)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'situations', NULL, 210,
    'Situations & Guest Issues',
    'Situaciones y Problemas con Comensales',
    '### Wrong Temperature or Preparation

If a guest''s meal was not prepared as they liked (e.g., steak temperature is incorrect):

1. **Apologize** immediately
2. **Remove the item** and inform the kitchen of how the guest would like it prepared
3. **Inform a FOH manager and the Chef** in charge
4. The Chef will send a **complimentary appetizer or small item** — must be delivered within 1-2 minutes
5. **Replace used cutlery** with new cutlery
6. When the new item arrives, ensure it is correct and that a **manager has spoken with the guest**
7. **Check back** after the guest has had 2 bites or 2 minutes with the item

### Late Food

Food over 5-10 minutes past expected ticket time is considered late:

- **Inform a FOH manager and HOH manager**
- If you notify management within 5 minutes of the dish being late, it becomes the manager''s responsibility
- The manager will assess the situation and may send a **complimentary appetizer or cocktails**

### Spills

If you spill something on a guest:

1. **Apologize**
2. **Assist in cleaning** the spill quickly
3. **Inform a manager** — ensure a manager visits the table

### Guest Didn''t Like Their Food

1. **Apologize**
2. **Remove the item** immediately
3. Ask if they would like a **replacement item**
4. The item most likely will not be charged (manager''s decision)

### Handling Complaints

With any situation, remain **calm, cool, and collected**. Be professional:

1. **Acknowledge** the complaint
2. **Apologize** sincerely
3. **Act quickly**
4. **Be positive**
5. **Communicate with managers** immediately so they can approach the guest
6. **Take ownership** of the situation',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 26: Being Part of a Team  (sort 220)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'teamwork', NULL, 220,
    'Being Part of a Team',
    'Trabajo en Equipo',
    'Working as a team may be the most important part of your job. Only by working together can we maintain our standards and ensure guests have an extraordinary experience.

Your responsibilities as a team member:

- **Greet all guests** — not just those at your tables
- **Help clear any and all tables**
- **Run food** whenever possible
- **Fulfill all guests'' needs**
- **Ask and offer help** to all fellow team members

If you see a guest or team member in need of help, **it is your job to help**. Do everything you can to assist in fulfilling their needs.

> **Remember**: Team service means anyone and everyone helps in all aspects of the restaurant, regardless of the task.',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 27: Study Guide  (sort 230)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'study-guide', NULL, 230,
    'Study Guide',
    'Guía de Estudio',
    'These training cards are yours to keep. We encourage you to write on them and take notes throughout your training. You are responsible for learning all the information and will be tested on it.

### Review Questions

1. What does it mean to be a Prime Steakhouse?
2. What items should you have with you at the beginning of every shift?
3. List 3 of your job responsibilities.
4. What are food allergies?
5. Name 2 of the most common ingredients people are allergic to.
6. When seating any guest, what do you have to mention?
7. What must be mentioned during your first approach?
8. What must be mentioned during your second approach?
9. Give an example of your introduction.
10. Give 3 examples of guest service standards.
11. Explain how service should go from your introduction to when you are wishing them a good night.
12. What are our time standards for the following items to hit the table?
    - Beverages
    - Appetizers
    - Entrées
    - Desserts
13. When serving any bottle product, which way should the label face?
14. When replacing any cutlery, how would you deliver it?
15. A guest''s steak came at the wrong temperature. What should you do and in what order?
16. What are some examples of professional behavior?
17. Why is it important to read your guest?
18. When offering suggestions, which should you offer? At the least, how many items do you suggest?
19. What does team service mean?
20. What are the daily specials?
21. How often do the daily specials change?
22. Name the five steak temperatures and describe each one.
23. What are 3 signature cuts on our menu?
24. What is our signature bourbon cocktail?
25. How should a steak order be taken? What details must you confirm?',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 28: Phrases to Avoid & Use  (sort 240)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'phrases', NULL, 240,
    'Phrases to Avoid & Use',
    'Frases a Evitar y Usar',
    '| Avoid | Use Instead |
|-------|-------------|
| "No, we don''t do that" | "Let me find out for you" |
| "Alright / Okay" | "My pleasure" |
| "I don''t know, it''s my first day" | "Let me find out for you" |
| "Hi folks / Y''all / guys / gals" | "Good evening!" |
| "You should have..." | "I highly recommend... / If I may suggest" |
| Giving verbal directions | "Right this way" *(use open hand gesture)* |
| "Hold on a second" | "One moment please" |
| "Can you wait / hold on" (phone) | "May I place you on hold?" |
| "I don''t like [wine, bourbon]" | "I prefer the filet, but all selections are wonderful" |
| "Alright / Okay / Good" | "Fabulous / Wonderful / Excellent" |
| "Can I help you?" | "May I assist you?" |
| "Really busy / having a bad day" | "I''m just great, thank you" |
| "The kitchen is backed up" | "I apologize. Let me get a manager" |',
    NULL, 'published', 1, v_user_id);


  -- ───────────────────────────────────────────────────────────────────────────
  -- Section 29: Glossary  (sort 250)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES (v_group_id, 'server', 'glossary', NULL, 250,
    'Glossary',
    'Glosario',
    '**Prime** — The highest USDA beef grade, indicating superior marbling, tenderness, and flavor. Only about 2-3% of all beef earns the Prime designation.

**Marbling** — The white flecks of intramuscular fat within a cut of beef. More marbling generally means more flavor and tenderness.

**Dry-Aged** — A process where beef is stored in a controlled, open-air environment for an extended period (typically 21-45 days). This concentrates flavor and enhances tenderness.

**Wet-Aged** — A process where beef is vacuum-sealed and aged in its own juices. This method retains moisture and produces a milder flavor than dry-aging.

**Filet Mignon** — The most tender cut of beef, taken from the smaller end of the tenderloin. Known for its buttery texture and mild flavor.

**Ribeye** — A richly marbled cut from the rib section. Known for its bold, beefy flavor and juicy texture. Available bone-in or boneless.

**New York Strip** — A classic steakhouse cut from the short loin. Offers a firm texture with a strip of fat along one edge that adds flavor.

**Tomahawk** — A bone-in ribeye with the full rib bone left intact, resembling an axe. A dramatic, showpiece cut with exceptional flavor.

**Porterhouse** — A large cut that includes both the New York strip and a generous portion of the tenderloin, separated by a T-shaped bone.

**Au Poivre** — A French preparation featuring a cracked peppercorn crust, typically finished with a cognac cream sauce.

**Oscar Style** — A preparation topped with lump crab meat, asparagus, and béarnaise sauce.

**Béarnaise** — A classic French sauce made from clarified butter, egg yolks, and tarragon. A traditional steakhouse accompaniment.

**Bourbon** — An American whiskey made primarily from corn and aged in new charred oak barrels. The backbone of our beverage program.

**Neat** — A spirit served at room temperature with no ice, water, or mixer.

**On the Rocks** — A spirit served over ice.',
    NULL, 'published', 1, v_user_id);

END;
$$;
