// ═══════════════════════════════════════════════════════════════
// Civic Social — Server-Side User Registry
// ═══════════════════════════════════════════════════════════════
//
// Central registry of all users (mock + real signups).
// When DATABASE_URL is set, uses Prisma (SearchableUser) so users
// are discoverable across all serverless instances. Otherwise
// falls back to in-memory store (instance-local only).
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from './db';
import { getFollowingIds } from './social-store';

// ─── Types ───────────────────────────────────────────────────

export interface RegisteredUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  bio: string;
  affiliation: string;
  avatarUrl: string | null;
  /** Server-assigned verification level */
  verificationLevel: 'EXPERT_VERIFIED' | 'OFFICIAL_VERIFIED' | 'CITIZEN_VERIFIED' | 'EMAIL_VERIFIED' | 'UNVERIFIED';
  /** true for EXPERT/OFFICIAL/CITIZEN verified */
  isVerified: boolean;
  /** 0-100 credibility score derived from platform behavior */
  credibilityScore: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: string;
  // Normalized search fields (lowercase, trimmed)
  _displayNameNorm: string;
  _usernameNorm: string;
}

export interface UserSearchResult {
  user: Omit<RegisteredUser, '_displayNameNorm' | '_usernameNorm' | 'email'>;
  matchScore: number;
  rankScore: number;
}

type VerificationLevel = RegisteredUser['verificationLevel'];

function rowToRegisteredUser(row: {
  id: string;
  displayName: string;
  username: string;
  email: string;
  bio: string;
  affiliation: string;
  avatarUrl: string | null;
  verificationLevel: string;
  isVerified: boolean;
  credibilityScore: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: Date;
  displayNameNorm: string;
  usernameNorm: string;
}): RegisteredUser {
  return {
    id: row.id,
    displayName: row.displayName,
    username: row.username,
    email: row.email,
    bio: row.bio,
    affiliation: row.affiliation,
    avatarUrl: row.avatarUrl,
    verificationLevel: row.verificationLevel as VerificationLevel,
    isVerified: row.isVerified,
    credibilityScore: row.credibilityScore,
    followerCount: row.followerCount,
    followingCount: row.followingCount,
    postCount: row.postCount,
    createdAt: row.createdAt.toISOString(),
    _displayNameNorm: row.displayNameNorm,
    _usernameNorm: row.usernameNorm,
  };
}

// ─── Store ───────────────────────────────────────────────────

interface UserRegistryStore {
  users: Map<string, RegisteredUser>;
}

const STORE_KEY = Symbol.for('civic.user.registry');

interface GlobalWithStore {
  [key: symbol]: UserRegistryStore | undefined;
}

function getStore(): UserRegistryStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { users: new Map() };
    seedMockUsers(g[STORE_KEY]!);
  }
  return g[STORE_KEY]!;
}

// ─── Seed from mock authors ──────────────────────────────────

function seedMockUsers(store: UserRegistryStore) {
  const seeds: Omit<RegisteredUser, '_displayNameNorm' | '_usernameNorm'>[] = [
    {
      id: 'user-sarah',
      displayName: 'Sarah Chen',
      username: 'sarah-chen',
      email: 'sarah@example.com',
      bio: 'Policy analyst specializing in healthcare reform. Stanford PhD. Cross-party dialogue advocate.',
      affiliation: 'center-left',
      avatarUrl: null,
      verificationLevel: 'EXPERT_VERIFIED',
      isVerified: true,
      credibilityScore: 92,
      followerCount: 14200,
      followingCount: 340,
      postCount: 287,
      createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
    },
    {
      id: 'user-marcus',
      displayName: 'Marcus Johnson',
      username: 'marcus-johnson',
      email: 'marcus@example.com',
      bio: 'Economics correspondent. Former WSJ. Tracking fiscal policy & markets.',
      affiliation: 'center-right',
      avatarUrl: null,
      verificationLevel: 'CITIZEN_VERIFIED',
      isVerified: true,
      credibilityScore: 78,
      followerCount: 8700,
      followingCount: 520,
      postCount: 154,
      createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    },
    {
      id: 'user-elena',
      displayName: 'Dr. Elena Rodriguez',
      username: 'elena-rodriguez',
      email: 'elena@example.com',
      bio: 'Health policy researcher at Johns Hopkins. Focus on equitable healthcare access.',
      affiliation: 'center',
      avatarUrl: null,
      verificationLevel: 'EXPERT_VERIFIED',
      isVerified: true,
      credibilityScore: 95,
      followerCount: 22300,
      followingCount: 180,
      postCount: 412,
      createdAt: new Date(Date.now() - 240 * 86400000).toISOString(),
    },
    {
      id: 'user-james',
      displayName: "James O'Brien",
      username: 'james-obrien',
      email: 'james@example.com',
      bio: 'Small business owner. Vocal on tax policy & deregulation.',
      affiliation: 'right',
      avatarUrl: null,
      verificationLevel: 'EMAIL_VERIFIED',
      isVerified: false,
      credibilityScore: 45,
      followerCount: 1200,
      followingCount: 890,
      postCount: 67,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    },
    {
      id: 'user-amara',
      displayName: 'Amara Okafor',
      username: 'amara-okafor',
      email: 'amara@example.com',
      bio: 'Climate scientist & policy advisor. Making research accessible to everyone.',
      affiliation: 'left',
      avatarUrl: null,
      verificationLevel: 'EXPERT_VERIFIED',
      isVerified: true,
      credibilityScore: 91,
      followerCount: 18500,
      followingCount: 290,
      postCount: 356,
      createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
    },
    {
      id: 'user-david',
      displayName: 'David Kim',
      username: 'david-kim',
      email: 'david@example.com',
      bio: 'Immigration attorney. Focusing on bipartisan reform solutions.',
      affiliation: 'center-left',
      avatarUrl: null,
      verificationLevel: 'CITIZEN_VERIFIED',
      isVerified: true,
      credibilityScore: 72,
      followerCount: 5400,
      followingCount: 410,
      postCount: 98,
      createdAt: new Date(Date.now() - 150 * 86400000).toISOString(),
    },
    {
      id: 'user-rachel',
      displayName: 'Rachel Thompson',
      username: 'rachel-thompson',
      email: 'rachel@example.com',
      bio: 'Veterans affairs advocate. Former Army nurse. Data-driven healthcare analysis.',
      affiliation: 'center-right',
      avatarUrl: null,
      verificationLevel: 'CITIZEN_VERIFIED',
      isVerified: true,
      credibilityScore: 83,
      followerCount: 9800,
      followingCount: 350,
      postCount: 201,
      createdAt: new Date(Date.now() - 160 * 86400000).toISOString(),
    },
    {
      id: 'user-michael',
      displayName: 'Prof. Michael Adler',
      username: 'michael-adler',
      email: 'michael@example.com',
      bio: 'Constitutional law professor at Georgetown. Supreme Court scholar.',
      affiliation: 'center',
      avatarUrl: null,
      verificationLevel: 'EXPERT_VERIFIED',
      isVerified: true,
      credibilityScore: 96,
      followerCount: 31000,
      followingCount: 120,
      postCount: 524,
      createdAt: new Date(Date.now() - 300 * 86400000).toISOString(),
    },
  ];

  for (const s of seeds) {
    store.users.set(s.id, {
      ...s,
      _displayNameNorm: s.displayName.toLowerCase().trim(),
      _usernameNorm: s.username.toLowerCase().trim(),
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════

export async function registerUser(input: {
  id: string;
  displayName: string;
  username: string;
  email: string;
  bio?: string;
  affiliation?: string;
}): Promise<RegisteredUser> {
  const usernameVal = input.username || input.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
  const displayNameNorm = input.displayName.toLowerCase().trim();
  const usernameNorm = usernameVal.toLowerCase().trim();

  if (isDbAvailable()) {
    // Upsert by email (unique) so that session ID mismatches don't cause P2002.
    const row = await prisma.searchableUser.upsert({
      where: { email: input.email },
      create: {
        id: input.id,
        displayName: input.displayName,
        username: usernameVal,
        email: input.email,
        bio: input.bio ?? '',
        affiliation: input.affiliation ?? '',
        displayNameNorm,
        usernameNorm,
      },
      update: {
        displayName: input.displayName,
        username: usernameVal,
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.affiliation !== undefined && { affiliation: input.affiliation }),
        displayNameNorm,
        usernameNorm,
      },
    });
    return rowToRegisteredUser(row);
  }

  const store = getStore();
  const existing = store.users.get(input.id);
  if (existing) {
    existing.displayName = input.displayName || existing.displayName;
    existing.username = usernameVal || existing.username;
    existing.email = input.email || existing.email;
    if (input.bio) existing.bio = input.bio;
    if (input.affiliation) existing.affiliation = input.affiliation;
    existing._displayNameNorm = displayNameNorm;
    existing._usernameNorm = usernameNorm;
    return existing;
  }

  const user: RegisteredUser = {
    id: input.id,
    displayName: input.displayName,
    username: usernameVal,
    email: input.email,
    bio: input.bio || '',
    affiliation: input.affiliation || '',
    avatarUrl: null,
    verificationLevel: 'EMAIL_VERIFIED',
    isVerified: false,
    credibilityScore: 50,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    createdAt: new Date().toISOString(),
    _displayNameNorm: displayNameNorm,
    _usernameNorm: usernameNorm,
  };

  store.users.set(user.id, user);
  return user;
}

export async function getUserById(id: string): Promise<RegisteredUser | null> {
  if (isDbAvailable()) {
    const row = await prisma.searchableUser.findUnique({ where: { id } });
    return row ? rowToRegisteredUser(row) : null;
  }
  return getStore().users.get(id) ?? null;
}

export async function getUserByUsername(username: string): Promise<RegisteredUser | null> {
  if (isDbAvailable()) {
    const norm = username.toLowerCase().trim();
    const row = await prisma.searchableUser.findFirst({
      where: { usernameNorm: norm },
    });
    return row ? rowToRegisteredUser(row) : null;
  }
  const store = getStore();
  const norm = username.toLowerCase().trim();
  for (const user of store.users.values()) {
    if (user._usernameNorm === norm || user.username === username) return user;
  }
  return null;
}

export async function updateUserProfile(
  id: string,
  updates: Partial<Pick<RegisteredUser, 'displayName' | 'username' | 'bio' | 'affiliation' | 'avatarUrl'>>
): Promise<RegisteredUser | null> {
  if (isDbAvailable()) {
    const existing = await prisma.searchableUser.findUnique({ where: { id } });
    if (!existing) return null;
    const data: {
      displayName?: string;
      username?: string;
      displayNameNorm?: string;
      usernameNorm?: string;
      bio?: string;
      affiliation?: string;
      avatarUrl?: string | null;
    } = {};
    if (updates.displayName !== undefined) {
      data.displayName = updates.displayName;
      data.displayNameNorm = updates.displayName.toLowerCase().trim();
    }
    if (updates.username !== undefined) {
      data.username = updates.username;
      data.usernameNorm = updates.username.toLowerCase().trim();
    }
    if (updates.bio !== undefined) data.bio = updates.bio;
    if (updates.affiliation !== undefined) data.affiliation = updates.affiliation;
    if (updates.avatarUrl !== undefined) data.avatarUrl = updates.avatarUrl;
    if (Object.keys(data).length === 0) return rowToRegisteredUser(existing);
    const row = await prisma.searchableUser.update({ where: { id }, data });
    return rowToRegisteredUser(row);
  }

  const user = getStore().users.get(id);
  if (!user) return null;

  if (updates.displayName) {
    user.displayName = updates.displayName;
    user._displayNameNorm = updates.displayName.toLowerCase().trim();
  }
  if (updates.username) {
    user.username = updates.username;
    user._usernameNorm = updates.username.toLowerCase().trim();
  }
  if (updates.bio !== undefined) user.bio = updates.bio;
  if (updates.affiliation !== undefined) user.affiliation = updates.affiliation;
  if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl;

  return user;
}

// ═══════════════════════════════════════════════════════════════
// SEARCH WITH RANKING
// ═══════════════════════════════════════════════════════════════

function computeMatchScore(query: string, user: RegisteredUser): number {
  const q = query.toLowerCase().trim();
  if (!q) return 100; // no query = show all

  // Exact username match
  if (user._usernameNorm === q) return 1000;
  // Exact display name match
  if (user._displayNameNorm === q) return 900;
  // Username starts with query
  if (user._usernameNorm.startsWith(q)) return 700;
  // Display name starts with query (first or last)
  const nameParts = user._displayNameNorm.split(/\s+/);
  if (nameParts.some((p) => p.startsWith(q))) return 600;
  // Display name contains query
  if (user._displayNameNorm.includes(q)) return 400;
  // Username contains query
  if (user._usernameNorm.includes(q)) return 350;
  // Bio contains query
  if (user.bio.toLowerCase().includes(q)) return 100;

  return 0; // no match
}

function computeRankScore(matchScore: number, user: RegisteredUser): number {
  const verifiedBoost = user.isVerified ? 100000 : 0;
  const credBoost = user.credibilityScore * 100;
  const popularityBoost = Math.min(user.followerCount / 10, 5000);
  return verifiedBoost + credBoost + matchScore + popularityBoost;
}

export async function searchUsers(options: {
  query: string;
  scope?: 'global' | 'followers';
  viewerId?: string;
  limit?: number;
  cursor?: number;
}): Promise<{ results: UserSearchResult[]; total: number; hasMore: boolean }> {
  const { query, scope = 'global', viewerId, limit = 20, cursor = 0 } = options;
  const q = query.toLowerCase().trim();

  let users: RegisteredUser[];

  if (isDbAvailable()) {
    const where = q
      ? {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' as const } },
            { username: { contains: q, mode: 'insensitive' as const } },
            { displayNameNorm: { contains: q, mode: 'insensitive' as const } },
            { usernameNorm: { contains: q, mode: 'insensitive' as const } },
            { bio: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const rows = await prisma.searchableUser.findMany({ where });
    users = rows.map(rowToRegisteredUser);
  } else {
    users = Array.from(getStore().users.values());
  }

  let candidateIds: Set<string> | null = null;
  if (scope === 'followers' && viewerId) {
    candidateIds = new Set(getFollowingIds(viewerId));
  }

  const scored: UserSearchResult[] = [];

  for (const user of users) {
    if (candidateIds && !candidateIds.has(user.id)) continue;

    const matchScore = computeMatchScore(q, user);
    if (matchScore === 0 && q) continue;

    const rankScore = computeRankScore(matchScore, user);
    const { _displayNameNorm, _usernameNorm, email, ...safeUser } = user;
    scored.push({ user: safeUser, matchScore, rankScore });
  }

  scored.sort((a, b) => b.rankScore - a.rankScore);

  const total = scored.length;
  const paginated = scored.slice(cursor, cursor + limit);
  const hasMore = cursor + limit < total;

  return { results: paginated, total, hasMore };
}

// ═══════════════════════════════════════════════════════════════
// FOLLOWER LIST (with user details)
// ═══════════════════════════════════════════════════════════════

export async function getFollowersWithDetails(userId: string): Promise<RegisteredUser[]> {
  if (isDbAvailable()) {
    const rows = await prisma.searchableUser.findMany();
    return rows.map(rowToRegisteredUser);
  }
  return Array.from(getStore().users.values());
}

export async function getAllUserCount(): Promise<number> {
  if (isDbAvailable()) return prisma.searchableUser.count();
  return getStore().users.size;
}
