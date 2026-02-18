/**
 * Centralized AI Action Configuration
 *
 * Maps all 18 product AI actions to their mode (tts, conversation, chat)
 * and UI metadata. Used by ProductAIDrawer and CardView components.
 */

// =============================================================================
// TYPES
// =============================================================================

export type AIActionMode = 'tts' | 'voice-tts' | 'conversation' | 'chat';

export interface AIActionConfig {
  /** Action key matching ai_prompts slug suffix */
  key: string;
  /** English label */
  label: string;
  /** Spanish label */
  labelEs: string;
  /** Lucide icon name */
  icon: string;
  /** Routing mode: tts (read aloud), conversation (WebRTC), chat (freeform) */
  mode: AIActionMode;
  /** true = AI responds immediately on open; false = wait for user input */
  autoTrigger: boolean;
  /** true = connect voice session but don't have AI speak first */
  noGreeting?: boolean;
}

/** A group of actions displayed as a dropdown button */
export interface AIActionGroup {
  key: string;
  label: string;
  labelEs: string;
  icon: string;
  children: AIActionConfig[];
}

/** An action item is either a standalone action or a group with children */
export type AIActionItem = AIActionConfig | AIActionGroup;

/** Type guard: true if the item is a group with children */
export function isActionGroup(item: AIActionItem): item is AIActionGroup {
  return 'children' in item;
}

// =============================================================================
// ACTION CONFIGS BY DOMAIN
// =============================================================================

export const PRODUCT_AI_ACTIONS: Record<string, AIActionConfig[]> = {
  dishes: [
    { key: 'practicePitch', label: 'Practice a pitch', labelEs: 'Practica un pitch', icon: 'mic', mode: 'conversation', autoTrigger: true },
    { key: 'samplePitch', label: 'Hear a sample pitch', labelEs: 'Escucha un pitch', icon: 'play', mode: 'voice-tts', autoTrigger: true },
    { key: 'teachMe', label: 'Teach Me', labelEs: 'Ensenname', icon: 'graduation-cap', mode: 'conversation', autoTrigger: true },
    { key: 'questions', label: 'Questions?', labelEs: 'Preguntas?', icon: 'help-circle', mode: 'conversation', autoTrigger: true },
  ],
  wines: [
    { key: 'explainToGuest', label: 'Practice a pitch', labelEs: 'Practica un pitch', icon: 'mic', mode: 'conversation', autoTrigger: true },
    { key: 'wineDetails', label: 'Hear a sample pitch', labelEs: 'Escucha un pitch', icon: 'play', mode: 'voice-tts', autoTrigger: true },
    { key: 'teachMe', label: 'Teach Me', labelEs: 'Ensenname', icon: 'graduation-cap', mode: 'conversation', autoTrigger: true },
    { key: 'foodPairings', label: 'Food pairings', labelEs: 'Maridaje', icon: 'utensils-crossed', mode: 'voice-tts', autoTrigger: true },
    { key: 'questions', label: 'Questions?', labelEs: 'Preguntas?', icon: 'help-circle', mode: 'conversation', autoTrigger: true },
  ],
  cocktails: [
    { key: 'explainToGuest', label: 'Practice a pitch', labelEs: 'Practica un pitch', icon: 'mic', mode: 'conversation', autoTrigger: true },
    { key: 'samplePitch', label: 'Hear a sample pitch', labelEs: 'Escucha un pitch', icon: 'play', mode: 'voice-tts', autoTrigger: true },
    { key: 'teachMe', label: 'Teach Me', labelEs: 'Ensenname', icon: 'graduation-cap', mode: 'conversation', autoTrigger: true },
    { key: 'foodPairings', label: 'Food pairings', labelEs: 'Maridaje', icon: 'utensils-crossed', mode: 'voice-tts', autoTrigger: true },
    { key: 'questions', label: 'Questions?', labelEs: 'Preguntas?', icon: 'help-circle', mode: 'conversation', autoTrigger: true },
  ],
  recipes: [
    { key: 'teachMe', label: 'Teach Me', labelEs: 'Ensenname', icon: 'graduation-cap', mode: 'tts', autoTrigger: true },
    { key: 'quizMe', label: 'Quiz Me', labelEs: 'Ponme a prueba', icon: 'clipboard-list', mode: 'conversation', autoTrigger: true },
    { key: 'questions', label: 'Ask a question', labelEs: 'Haz una pregunta', icon: 'help-circle', mode: 'conversation', autoTrigger: true },
  ],
  beer_liquor: [
    { key: 'teachMe', label: 'Teach Me', labelEs: 'Ensenname', icon: 'graduation-cap', mode: 'conversation', autoTrigger: true },
    { key: 'suggestPairing', label: 'Suggest pairing', labelEs: 'Sugerir maridaje', icon: 'utensils-crossed', mode: 'voice-tts', autoTrigger: true },
    { key: 'questions', label: 'Ask a question', labelEs: 'Haz una pregunta', icon: 'help-circle', mode: 'conversation', autoTrigger: true },
  ],
};

// =============================================================================
// SOS ACTIONS (grouped dropdown pattern)
// =============================================================================

export const SOS_AI_ACTIONS: AIActionItem[] = [
  // Dropdown group: Listen
  {
    key: 'listen',
    label: 'Listen',
    labelEs: 'Escuchar',
    icon: 'play',
    children: [
      { key: 'listen1stApproach', label: '1st Approach', labelEs: '1er Acercamiento', icon: 'play', mode: 'voice-tts', autoTrigger: true },
      { key: 'listen2ndApproach', label: '2nd Approach', labelEs: '2do Acercamiento', icon: 'play', mode: 'voice-tts', autoTrigger: true },
      { key: 'listenDessert', label: 'Dessert', labelEs: 'Postre', icon: 'play', mode: 'voice-tts', autoTrigger: true },
      { key: 'listenCheck', label: 'The Check', labelEs: 'La Cuenta', icon: 'play', mode: 'voice-tts', autoTrigger: true },
    ],
  },
  // Dropdown group: Practice
  {
    key: 'practice',
    label: 'Practice',
    labelEs: 'Practicar',
    icon: 'mic',
    children: [
      { key: 'practice1stApproach', label: '1st Approach', labelEs: '1er Acercamiento', icon: 'mic', mode: 'conversation', autoTrigger: true },
      { key: 'practice2ndApproach', label: '2nd Approach', labelEs: '2do Acercamiento', icon: 'mic', mode: 'conversation', autoTrigger: true },
      { key: 'practiceDessert', label: 'Dessert', labelEs: 'Postre', icon: 'mic', mode: 'conversation', autoTrigger: true },
      { key: 'practiceCheck', label: 'The Check', labelEs: 'La Cuenta', icon: 'mic', mode: 'conversation', autoTrigger: true },
    ],
  },
  // Standalone button
  {
    key: 'questions',
    label: 'Questions?',
    labelEs: 'Preguntas?',
    icon: 'help-circle',
    mode: 'conversation',
    autoTrigger: true,
  },
];

// =============================================================================
// HELPER
// =============================================================================

export function getActionConfig(domain: string, key: string): AIActionConfig | undefined {
  if (domain === 'steps_of_service') {
    for (const item of SOS_AI_ACTIONS) {
      if (isActionGroup(item)) {
        const found = item.children.find(c => c.key === key);
        if (found) return found;
      } else if (item.key === key) {
        return item;
      }
    }
    return undefined;
  }
  return PRODUCT_AI_ACTIONS[domain]?.find(a => a.key === key);
}
