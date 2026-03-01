import type { IconType } from 'react-icons';
import { HiMicrophone } from 'react-icons/hi2';
import { HiPlay, HiAcademicCap, HiQuestionMarkCircle } from 'react-icons/hi2';
import { PiKnifeFill } from 'react-icons/pi';
import { HiClipboardDocumentList } from 'react-icons/hi2';

/**
 * Maps ai-action-config icon keys to react-icons components.
 * Used across all CardView components for AI action buttons.
 */
export const AI_ACTION_ICONS: Record<string, IconType> = {
  mic: HiMicrophone,
  play: HiPlay,
  'graduation-cap': HiAcademicCap,
  'help-circle': HiQuestionMarkCircle,
  'utensils-crossed': PiKnifeFill,
  'clipboard-list': HiClipboardDocumentList,
};
