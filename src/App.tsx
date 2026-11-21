import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';
import {
  createVoiceProfile,
  deleteAudioProject,
  deleteVoiceProfile,
  ensureUserProfile,
  incrementCharactersUsed,
  loadProjectScenes,
  saveAudioProjectWithScenes,
  subscribeAudioProjects,
  subscribeVoiceProfiles,
  updateUserPlan,
  updateUserSettings,
} from './lib/firestoreStore';
import { BADINI_VOICE_LIBRARY } from './data/badiniVoices';
import {
  AudioProjectDoc,
  BadiniDialect,
  NavPage,
  StoryCategoryId,
  StoryCharacter,
  StoryLine,
  UserProfileDoc,
  VoicePersona,
  VoiceProfileDoc,
} from './types/studio';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudioShell } from './components/StudioShell';
import { HomePage } from './components/pages/HomePage';
import { TTSPage } from './components/pages/TTSPage';
import { VoiceLibraryPage } from './components/pages/VoiceLibraryPage';
import { StoryCreatorPage } from './components/pages/StoryCreatorPage';
import { MultiCharacterStudioPage } from './components/pages/MultiCharacterStudioPage';
import { PresentationPage } from './components/pages/PresentationPage';
import { AudioProjectsPage } from './components/pages/AudioProjectsPage';
import { MyVoiceLibraryPage } from './components/pages/MyVoiceLibraryPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { PlansPage } from './components/pages/PlansPage';

function BadiniStudioApp() {
  const [activePage, setActivePage] = useState<NavPage>('home');
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [customProfiles, setCustomProfiles] = useState<VoiceProfileDoc[]>([]);
  const [projects, setProjects] = useState<AudioProjectDoc[]>([]);

  // Cross-page navigation payloads
  const [ttsLaunchPayload, setTtsLaunchPayload] = useState<{
    text: string;
    voiceId: string;
    dialect: BadiniDialect;
  } | null>(null);
  const [storyLaunchCategory, setStoryLaunchCategory] = useState<StoryCategoryId>('emotional');
  const [studioLaunchPayload, setStudioLaunchPayload] = useState<{
    title: string;
    category: string;
    dialect: BadiniDialect;
    bgMusicPreset: string;
    sfxPreset: string;
    characters: StoryCharacter[];
    lines: StoryLine[];
  } | null>(null);

  useEffect(() => {
    let unsubVoices: (() => void) | null = null;
    let unsubProjects: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubVoices) {
        unsubVoices();
        unsubVoices = null;
      }
      if (unsubProjects) {
        unsubProjects();
        unsubProjects = null;
      }

      if (firebaseUser) {
        try {
          const profile = await ensureUserProfile(
            firebaseUser.uid,
            firebaseUser.displayName || 'Badini Creator',
            firebaseUser.email || 'creator@badinivoice.studio'
          );
          setUserProfile(profile);
          unsubVoices = subscribeVoiceProfiles(firebaseUser.uid, setCustomProfiles);
          unsubProjects = subscribeAudioProjects(firebaseUser.uid, setProjects);
        } catch (err) {
          console.error('Failed loading Firebase user state:', err);
        }
      } else {
        setUserProfile(null);
        setCustomProfiles([]);
        setProjects([]);
      }
    });

    return () => {
      unsubAuth();
      unsubVoices?.();
      unsubProjects?.();
    };
  }, []);

  // Merge built-in 11 Badini voices with user's custom Firestore VoiceProfiles
  const allVoices: VoicePersona[] = useMemo(() => {
    const customMapped: VoicePersona[] = customProfiles.map((vp) => ({
      id: vp.id,
      nameKurdish: vp.name,
      nameEnglish: vp.name,
      category: 'storytelling',
      categoryKurdish: 'دەنگێ تایبەتێ من',
      categoryEnglish: 'Custom Trained Voice',
      gender: vp.gender,
      ageLabel: vp.ageGroup || '25-35',
      region: vp.region,
      regionLabel: vp.region,
      baseVoice: vp.baseVoice,
      pitchShift: vp.pitchShift,
      timbrePrompt: vp.timbrePrompt,
      descriptionKurdish:
        vp.sampleTranscription || 'دەنگەکێ تایبەت کو ژ تۆمارا تە هاتیە گونجاندن.',
      sampleBadiniText:
        vp.sampleTranscription ||
        'سڵاڤ، ئەڤە نموونەیا دەنگێ من یێ گونجاندییە د ستۆدیۆیا بادینی دا.',
      isCustom: true,
      lexiconRules: vp.lexiconRules || [],
    }));
    return [...customMapped, ...BADINI_VOICE_LIBRARY];
  }, [customProfiles]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed or cancelled:', err);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleCharactersConsumed = (chars: number) => {
    if (!user || !userProfile || chars <= 0) return;
    const nextCount = (userProfile.charactersUsed || 0) + chars;
    setUserProfile((prev) => (prev ? { ...prev, charactersUsed: nextCount } : prev));
    incrementCharactersUsed(user.uid, userProfile.charactersUsed || 0, chars).catch(() => {});
  };

  const handleQuickLaunchTTS = (text: string, voiceId: string, dialect: BadiniDialect) => {
    setTtsLaunchPayload({ text, voiceId, dialect });
    setActivePage('tts');
  };

  const handleUseVoiceInStudio = (voiceId: string) => {
    const voice = allVoices.find((v) => v.id === voiceId) || allVoices[0];
    setStudioLaunchPayload({
      title: `پڕۆژەیێ دەنگی — ${voice.nameKurdish}`,
      category: 'دراما و دیالۆگ',
      dialect: voice.region,
      bgMusicPreset: 'oud_calm',
      sfxPreset: 'none',
      characters: [
        {
          id: 'char_lead',
          name: voice.nameKurdish,
          roleLabel: voice.categoryKurdish,
          voiceId: voice.id,
          defaultEmotion: 'calm',
        },
      ],
      lines: [
        {
          id: `line_${Date.now()}`,
          characterId: 'char_lead',
          characterName: voice.nameKurdish,
          voiceId: voice.id,
          emotion: 'calm',
          pauseAfterSec: 0.8,
          isNarration: false,
          text: voice.sampleBadiniText,
        },
      ],
    });
    setActivePage('studio');
  };

  const handleLoadProjectFromCloud = async (proj: AudioProjectDoc) => {
    if (!user) return;
    if (proj.projectType === 'tts') {
      const scenes = await loadProjectScenes(user.uid, proj.id);
      const first = scenes[0];
      setTtsLaunchPayload({
        text: first?.text || proj.scriptText,
        voiceId: first?.voiceId || allVoices[0].id,
        dialect: proj.dialectRegion || 'duhok',
      });
      setActivePage('tts');
      return;
    }

    const scenes = await loadProjectScenes(user.uid, proj.id);
    const charMap = new Map<string, StoryCharacter>();
    scenes.forEach((s) => {
      if (!charMap.has(s.characterName)) {
        charMap.set(s.characterName, {
          id: s.characterName,
          name: s.characterName,
          roleLabel: s.isNarration ? 'ڤەگێڕ' : 'کەسایەتی',
          voiceId: s.voiceId,
          defaultEmotion: s.emotion,
        });
      }
    });

    setStudioLaunchPayload({
      title: proj.title,
      category: proj.category,
      dialect: proj.dialectRegion,
      bgMusicPreset: proj.bgMusicPreset || 'oud_calm',
      sfxPreset: proj.sfxPreset || 'none',
      characters: Array.from(charMap.values()),
      lines: scenes,
    });
    setActivePage('studio');
  };

  return (
    <StudioShell
      activePage={activePage}
      onNavigate={setActivePage}
      user={user}
      userProfile={userProfile}
      customVoicesCount={customProfiles.length}
      projectsCount={projects.length}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      authBusy={authBusy}
    >
      {activePage === 'home' && (
        <HomePage
          onNavigate={setActivePage}
          onQuickLaunchTTS={handleQuickLaunchTTS}
          onSelectStoryCategory={(catId) => {
            setStoryLaunchCategory(catId as StoryCategoryId);
            setActivePage('story');
          }}
          recentProjects={projects}
          allVoices={allVoices}
        />
      )}

      {activePage === 'tts' && (
        <TTSPage
          allVoices={allVoices}
          initialText={ttsLaunchPayload?.text}
          initialVoiceId={ttsLaunchPayload?.voiceId}
          initialDialect={
            ttsLaunchPayload?.dialect || userProfile?.defaultDialect || 'duhok'
          }
          defaultFormat={userProfile?.defaultFormat || 'mp3'}
          defaultSpeed={userProfile?.defaultSpeed || 1.0}
          adaptationEnabled={userProfile?.adaptationEnabled ?? true}
          isSignedIn={Boolean(user)}
          onCharactersConsumed={handleCharactersConsumed}
          onSaveProject={async (payload) => {
            if (!user) return;
            await saveAudioProjectWithScenes(user.uid, {
              title: payload.title,
              projectType: 'tts',
              category: 'نڤێسین بۆ دەنگ',
              emotion: payload.emotion,
              dialectRegion: payload.dialect,
              scriptText: payload.text,
              totalDurationSec: payload.durationSec,
              bgMusicPreset: 'none',
              sfxPreset: 'none',
              lines: [
                {
                  characterName: payload.voice.nameKurdish,
                  voiceId: payload.voice.id,
                  baseVoice: payload.voice.baseVoice,
                  emotion: payload.emotion,
                  pauseAfterSec: 0,
                  isNarration: false,
                  text: payload.text,
                },
              ],
            });
          }}
        />
      )}

      {activePage === 'voices' && (
        <VoiceLibraryPage
          allVoices={allVoices}
          onUseInTTS={handleQuickLaunchTTS}
          onUseInStudio={handleUseVoiceInStudio}
        />
      )}

      {activePage === 'story' && (
        <StoryCreatorPage
          allVoices={allVoices}
          initialCategoryId={storyLaunchCategory}
          onLoadStoryIntoStudio={(payload) => {
            setStudioLaunchPayload(payload);
            setActivePage('studio');
          }}
        />
      )}

      {activePage === 'studio' && (
        <MultiCharacterStudioPage
          allVoices={allVoices}
          initialData={studioLaunchPayload}
          defaultFormat={userProfile?.defaultFormat || 'mp3'}
          adaptationEnabled={userProfile?.adaptationEnabled ?? true}
          isSignedIn={Boolean(user)}
          onCharactersConsumed={handleCharactersConsumed}
          onSaveProject={async (payload) => {
            if (!user) return;
            await saveAudioProjectWithScenes(user.uid, {
              title: payload.title,
              projectType: 'dialogue',
              category: payload.category,
              emotion: payload.lines[0]?.emotion || 'dramatic',
              dialectRegion: payload.dialect,
              scriptText: payload.lines
                .map((l) => `${l.characterName}: ${l.text}`)
                .join('\n'),
              totalDurationSec: payload.totalDurationSec,
              bgMusicPreset: payload.bgMusicPreset,
              sfxPreset: payload.sfxPreset,
              lines: payload.lines.map((l) => {
                const v = allVoices.find((item) => item.id === l.voiceId) || allVoices[0];
                return {
                  characterName: l.characterName,
                  voiceId: l.voiceId,
                  baseVoice: v.baseVoice,
                  emotion: l.emotion,
                  pauseAfterSec: l.pauseAfterSec,
                  isNarration: l.isNarration,
                  text: l.text,
                };
              }),
            });
          }}
        />
      )}

      {activePage === 'presentation' && (
        <PresentationPage
          onSendNotesToTTS={(text, dialect) => {
            setTtsLaunchPayload({
              text,
              voiceId: allVoices[0]?.id || 'zhirevan_young_male',
              dialect,
            });
            setActivePage('tts');
          }}
        />
      )}

      {activePage === 'projects' && (
        <AudioProjectsPage
          isSignedIn={Boolean(user)}
          onSignIn={handleSignIn}
          projects={projects}
          onLoadProject={handleLoadProjectFromCloud}
          onDeleteProject={async (projectId) => {
            if (!user) return;
            await deleteAudioProject(projectId, user.uid);
          }}
          onNavigate={setActivePage}
        />
      )}

      {activePage === 'my-voices' && (
        <MyVoiceLibraryPage
          isSignedIn={Boolean(user)}
          onSignIn={handleSignIn}
          customProfiles={customProfiles}
          onCreateProfile={async (input) => {
            if (!user) return;
            await createVoiceProfile(user.uid, input);
          }}
          onDeleteProfile={async (id) => {
            await deleteVoiceProfile(id);
          }}
        />
      )}

      {activePage === 'settings' && (
        <SettingsPage
          isSignedIn={Boolean(user)}
          onSignIn={handleSignIn}
          userProfile={userProfile}
          onSaveSettings={async (updates) => {
            if (!user) return;
            await updateUserSettings(user.uid, updates);
            setUserProfile((prev) => (prev ? { ...prev, ...updates } : prev));
          }}
        />
      )}

      {activePage === 'plans' && (
        <PlansPage
          isSignedIn={Boolean(user)}
          onSignIn={handleSignIn}
          userProfile={userProfile}
          onSelectPlan={async (plan) => {
            if (!user) return;
            await updateUserPlan(user.uid, plan);
            setUserProfile((prev) => (prev ? { ...prev, plan } : prev));
          }}
        />
      )}
    </StudioShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BadiniStudioApp />
    </ErrorBoundary>
  );
}
