# Badini Voice Studio — Security Specification & Invariants

## 1. Data Invariants
1. **Identity Isolation (`users/{userId}`)**: A user profile containing PII (`email`, `displayName`, subscription plan, dialect defaults) may ONLY be read, created, or updated by `request.auth.uid == userId` with a verified email. Unauthenticated reads or cross-user reads/lists are strictly denied.
2. **Voice Profile Ownership (`voiceProfiles/{profileId}`)**: Custom Badini voice profiles belong exclusively to `ownerId == request.auth.uid`. List queries must explicitly evaluate `resource.data.ownerId == request.auth.uid`.
3. **Project Ownership (`audioProjects/{projectId}`)**: Audio projects belong strictly to `ownerId == request.auth.uid`.
4. **Master Gate Relational Integrity (`audioProjects/{projectId}/scenes/{sceneId}`)**: An `AudioScene` cannot exist without a valid parent `AudioProject` owned by `request.auth.uid` (verified via `get()` on create/update/delete/get), and `ownerId` + `projectId` are immutable once created.
5. **Temporal Integrity & Anti-Update-Gap**: Every create enforces `createdAt == request.time && updatedAt == request.time`; every update enforces `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`, `incoming().ownerId == existing().ownerId`, strict `affectedKeys().hasOnly(...)` per action, and complete `isValid[Entity](incoming())` checks.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Identity Spoofing on User Create**: Write `/users/victimUid` as `attackerUid` -> `PERMISSION_DENIED`.
2. **Cross-User Project Read**: Read `/audioProjects/proj1` owned by `userA` while authenticated as `userB` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: Create `voiceProfiles/vp1` with extra ghost field `isVerified: true` -> `PERMISSION_DENIED`.
4. **Orphaned Scene Write**: Create `/audioProjects/nonExistent/scenes/s1` -> `PERMISSION_DENIED` (Master Gate `exists`/`get` fails).
5. **Cross-Owner Scene Injection**: Create `/audioProjects/userA_proj/scenes/s1` as `userB` even if `ownerId: userB` -> `PERMISSION_DENIED` (parent project owner check fails).
6. **ID Poisoning**: Write `/audioProjects/invalid$id!with*badchars` or 500-char ID -> `PERMISSION_DENIED` (`isValidId`).
7. **Script Payload Exhaustion**: Write `scriptText` > 12,000 chars or `title` > 140 chars -> `PERMISSION_DENIED`.
8. **Lexicon Array Overflow**: Write `voiceProfiles/vp1` with `lexiconRules` size > 25 or non-string element -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Create `audioProjects/p1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Owner Tampering**: Update `audioProjects/p1` attempting to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
11. **Unverified Email Write**: Attempt write when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
12. **Blanket Collection List**: Query `collection(db, 'audioProjects')` without `.where('ownerId', '==', uid)` -> `PERMISSION_DENIED`.
