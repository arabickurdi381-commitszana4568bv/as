export type NavPage =
  | 'home'
  | 'tts'
  | 'voices'
  | 'story'
  | 'studio'
  | 'presentation'
  | 'projects'
  | 'my-voices'
  | 'settings'
  | 'plans';

export interface PresentationSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  speakerNotes: string;
  visualIdea: string;
}

export interface PresentationDeck {
  title: string;
  subtitle: string;
  gammaReadyPrompt: string;
  slides: PresentationSlide[];
}

export type BadiniDialect = 'duhok' | 'zakho' | 'amedi' | 'akre';

export type BaseGeminiVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export type EmotionId =
  | 'happy'
  | 'sad'
  | 'crying'
  | 'angry'
  | 'romantic'
  | 'fearful'
  | 'excited'
  | 'calm'
  | 'serious'
  | 'inspirational'
  | 'whispering'
  | 'dramatic';

export type VoiceCategory =
  | 'young_male'
  | 'mature_male'
  | 'deep_narrator'
  | 'young_female'
  | 'mature_female'
  | 'emotional_male'
  | 'emotional_female'
  | 'documentary_narrator'
  | 'storytelling'
  | 'news_presenter'
  | 'seminar_presenter';

export interface VoicePersona {
  id: string;
  nameKurdish: string;
  nameEnglish: string;
  category: VoiceCategory;
  categoryKurdish: string;
  categoryEnglish: string;
  gender: 'male' | 'female';
  ageLabel: string;
  region: BadiniDialect;
  regionLabel: string;
  baseVoice: BaseGeminiVoice;
  pitchShift: number;
  timbrePrompt: string;
  descriptionKurdish: string;
  sampleBadiniText: string;
  isCustom?: boolean;
  lexiconRules?: string[];
}

export type StoryCategoryId =
  | 'emotional'
  | 'romantic'
  | 'sad'
  | 'historical'
  | 'religious'
  | 'educational'
  | 'seminar'
  | 'documentary'
  | 'news'
  | 'children';

export interface StoryCategoryMeta {
  id: StoryCategoryId;
  titleKurdish: string;
  titleEnglish: string;
  descriptionKurdish: string;
  defaultEmotion: EmotionId;
  samplePremise: string;
}

export interface StoryCharacter {
  id: string;
  name: string;
  roleLabel: string;
  voiceId: string;
  defaultEmotion: EmotionId;
}

export interface StoryLine {
  id: string;
  characterId: string;
  characterName: string;
  voiceId: string;
  emotion: EmotionId;
  pauseAfterSec: number;
  isNarration: boolean;
  text: string;
  adaptedText?: string;
  audioBase64?: string;
  recordedBlobUrl?: string;
  durationSec?: number;
}

export interface UserProfileDoc {
  ownerId: string;
  displayName: string;
  email: string;
  plan: 'free' | 'creator' | 'studio';
  defaultDialect: BadiniDialect;
  defaultFormat: 'wav' | 'mp3';
  defaultSpeed: number;
  adaptationEnabled: boolean;
  charactersUsed: number;
  createdAt: any;
  updatedAt: any;
}

export interface VoiceProfileDoc {
  id: string;
  ownerId: string;
  name: string;
  gender: 'male' | 'female';
  ageGroup: string;
  region: BadiniDialect;
  baseVoice: BaseGeminiVoice;
  pitchShift: number;
  timbrePrompt: string;
  sampleTranscription: string;
  lexiconRules: string[];
  createdAt: any;
  updatedAt: any;
}

export interface AudioProjectDoc {
  id: string;
  ownerId: string;
  title: string;
  projectType: 'tts' | 'story' | 'dialogue';
  category: string;
  emotion: string;
  dialectRegion: BadiniDialect;
  scriptText: string;
  linesCount: number;
  totalDurationSec: number;
  bgMusicPreset: string;
  sfxPreset: string;
  createdAt: any;
  updatedAt: any;
}

export interface AudioSceneDoc {
  id: string;
  ownerId: string;
  projectId: string;
  orderIndex: number;
  characterName: string;
  voiceId: string;
  baseVoice: BaseGeminiVoice;
  emotion: string;
  pauseSec: number;
  isNarration: boolean;
  text: string;
  adaptedText: string;
  createdAt: any;
  updatedAt: any;
}
