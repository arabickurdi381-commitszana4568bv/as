import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AudioProjectDoc,
  AudioSceneDoc,
  BadiniDialect,
  BaseGeminiVoice,
  StoryLine,
  UserProfileDoc,
  VoiceProfileDoc,
} from '../types/studio';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function ensureUserProfile(
  uid: string,
  displayName: string,
  email: string
): Promise<UserProfileDoc> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfileDoc;
    }
    const initialProfile: UserProfileDoc = {
      ownerId: uid,
      displayName: (displayName || 'Badini Creator').slice(0, 120),
      email: (email || 'creator@badinivoice.studio').slice(0, 254),
      plan: 'free',
      defaultDialect: 'duhok',
      defaultFormat: 'wav',
      defaultSpeed: 1.0,
      adaptationEnabled: true,
      charactersUsed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialProfile);
    const created = await getDoc(ref);
    return (created.data() as UserProfileDoc) || initialProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserSettings(
  uid: string,
  updates: {
    displayName: string;
    defaultDialect: BadiniDialect;
    defaultFormat: 'wav' | 'mp3';
    defaultSpeed: number;
    adaptationEnabled: boolean;
  }
) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: updates.displayName.slice(0, 120),
      defaultDialect: updates.defaultDialect,
      defaultFormat: updates.defaultFormat,
      defaultSpeed: Math.max(0.5, Math.min(2.0, updates.defaultSpeed)),
      adaptationEnabled: updates.adaptationEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserPlan(
  uid: string,
  plan: 'free' | 'creator' | 'studio'
) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      plan,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function incrementCharactersUsed(
  uid: string,
  currentCount: number,
  delta: number
) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      charactersUsed: Math.min(100000000, Math.max(0, Math.floor(currentCount + delta))),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeVoiceProfiles(
  uid: string,
  onData: (profiles: VoiceProfileDoc[]) => void
) {
  const path = 'voiceProfiles';
  const q = query(
    collection(db, path),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VoiceProfileDoc, 'id'>),
        }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createVoiceProfile(
  uid: string,
  input: {
    name: string;
    gender: 'male' | 'female';
    ageGroup: string;
    region: BadiniDialect;
    baseVoice: BaseGeminiVoice;
    pitchShift: number;
    timbrePrompt: string;
    sampleTranscription: string;
    lexiconRules: string[];
  }
): Promise<string> {
  const profileId = makeSafeId('vp');
  const path = `voiceProfiles/${profileId}`;
  try {
    const cleanRules = input.lexiconRules
      .map((r) => r.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 25);

    await setDoc(doc(db, 'voiceProfiles', profileId), {
      ownerId: uid,
      name: input.name.trim().slice(0, 80) || 'Badini Voice',
      gender: input.gender,
      ageGroup: input.ageGroup.trim().slice(0, 40) || '25-35',
      region: input.region,
      baseVoice: input.baseVoice,
      pitchShift: Math.max(-12, Math.min(12, input.pitchShift)),
      timbrePrompt: input.timbrePrompt.trim().slice(0, 600),
      sampleTranscription: (input.sampleTranscription || '').slice(0, 1000),
      lexiconRules: cleanRules,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return profileId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteVoiceProfile(profileId: string) {
  const path = `voiceProfiles/${profileId}`;
  try {
    await deleteDoc(doc(db, 'voiceProfiles', profileId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeAudioProjects(
  uid: string,
  onData: (projects: AudioProjectDoc[]) => void
) {
  const path = 'audioProjects';
  const q = query(
    collection(db, path),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AudioProjectDoc, 'id'>),
        }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function saveAudioProjectWithScenes(
  uid: string,
  input: {
    title: string;
    projectType: 'tts' | 'story' | 'dialogue';
    category: string;
    emotion: string;
    dialectRegion: BadiniDialect;
    scriptText: string;
    totalDurationSec: number;
    bgMusicPreset: string;
    sfxPreset: string;
    lines: {
      characterName: string;
      voiceId: string;
      baseVoice: BaseGeminiVoice;
      emotion: string;
      pauseAfterSec: number;
      isNarration: boolean;
      text: string;
      adaptedText?: string;
    }[];
  }
): Promise<string> {
  const projectId = makeSafeId('proj');
  const projectPath = `audioProjects/${projectId}`;

  try {
    await setDoc(doc(db, 'audioProjects', projectId), {
      ownerId: uid,
      title: input.title.trim().slice(0, 140) || 'پڕۆژەیێ دەنگی بادینی',
      projectType: input.projectType,
      category: input.category.slice(0, 80) || 'general',
      emotion: input.emotion.slice(0, 40) || 'calm',
      dialectRegion: input.dialectRegion,
      scriptText: input.scriptText.slice(0, 12000) || ' ',
      linesCount: Math.min(200, input.lines.length),
      totalDurationSec: Math.max(0, Math.min(7200, input.totalDurationSec)),
      bgMusicPreset: (input.bgMusicPreset || 'none').slice(0, 60),
      sfxPreset: (input.sfxPreset || 'none').slice(0, 60),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.lines.length > 0) {
      const batch = writeBatch(db);
      input.lines.slice(0, 200).forEach((line, idx) => {
        const sceneId = makeSafeId(`sc${idx}`);
        const sceneRef = doc(db, 'audioProjects', projectId, 'scenes', sceneId);
        batch.set(sceneRef, {
          ownerId: uid,
          projectId,
          orderIndex: idx,
          characterName: line.characterName.slice(0, 80) || 'Narrator',
          voiceId: line.voiceId.slice(0, 80) || 'zhirevan_young_male',
          baseVoice: line.baseVoice,
          emotion: line.emotion.slice(0, 40) || 'calm',
          pauseSec: Math.max(0, Math.min(10, line.pauseAfterSec)),
          isNarration: Boolean(line.isNarration),
          text: line.text.slice(0, 2000) || ' ',
          adaptedText: (line.adaptedText || line.text).slice(0, 2400),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return projectId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, projectPath);
  }
}

export async function loadProjectScenes(
  uid: string,
  projectId: string
): Promise<StoryLine[]> {
  const path = `audioProjects/${projectId}/scenes`;
  try {
    const q = query(
      collection(db, 'audioProjects', projectId, 'scenes'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as AudioSceneDoc)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((data, idx) => ({
        id: `${projectId}_${idx}`,
        characterId: data.characterName,
        characterName: data.characterName,
        voiceId: data.voiceId,
        emotion: (data.emotion as any) || 'calm',
        pauseAfterSec: data.pauseSec,
        isNarration: data.isNarration,
        text: data.text,
        adaptedText: data.adaptedText,
      }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteAudioProject(projectId: string, uid: string) {
  const path = `audioProjects/${projectId}`;
  try {
    // Delete child scenes first
    const q = query(
      collection(db, 'audioProjects', projectId, 'scenes'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'audioProjects', projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
