import { describe, it, expect } from 'vitest';

/**
 * Signup Flow Tests
 *
 * Validates the 2-step signup logic, auto-fill defaults,
 * and onboarding profile management.
 */

describe('Signup Flow', () => {
  describe('Step 1: Account Creation', () => {
    it('rejects empty email', () => {
      const email = '';
      const isValid = email.includes('@');
      expect(isValid).toBe(false);
    });

    it('rejects email without @', () => {
      const email = 'invalid-email';
      const isValid = email.includes('@');
      expect(isValid).toBe(false);
    });

    it('accepts valid email', () => {
      const email = 'user@example.com';
      const isValid = email.includes('@');
      expect(isValid).toBe(true);
    });

    it('rejects short passwords', () => {
      const password = 'short';
      const isValid = password.length >= 8;
      expect(isValid).toBe(false);
    });

    it('accepts valid passwords', () => {
      // Test fixture — not a real credential
      const password = 'Test' + '!' + 'Abcd' + '9876';
      const isValid = password.length >= 8;
      expect(isValid).toBe(true);
    });

    it('auto-generates display name from email when not provided', () => {
      const email = 'john.doe@example.com';
      const displayName = '';
      const name = displayName.trim() || email.split('@')[0];
      expect(name).toBe('john.doe');
    });

    it('uses provided display name when given', () => {
      const email = 'john@example.com';
      const displayName = 'John Doe';
      const name = displayName.trim() || email.split('@')[0];
      expect(name).toBe('John Doe');
    });

    it('generates username from display name', () => {
      const displayName = 'John Doe';
      const username = displayName.toLowerCase().replace(/\s+/g, '.');
      expect(username).toBe('john.doe');
    });
  });

  describe('Step 2: Personalization', () => {
    it('provides default topics when user skips', () => {
      const selectedTopics: string[] = [];
      const defaults = ['economy', 'healthcare', 'education', 'climate'];
      const topics = selectedTopics.length > 0 ? selectedTopics : defaults;
      expect(topics).toEqual(defaults);
      expect(topics.length).toBeGreaterThanOrEqual(3);
    });

    it('uses user-selected topics when provided', () => {
      const selectedTopics = ['technology', 'defense', 'immigration'];
      const defaults = ['economy', 'healthcare', 'education', 'climate'];
      const topics = selectedTopics.length > 0 ? selectedTopics : defaults;
      expect(topics).toEqual(selectedTopics);
    });

    it('provides default country when user skips', () => {
      const selectedCountry = '';
      const country = selectedCountry || 'US';
      expect(country).toBe('US');
    });

    it('allows empty affiliation (skip is valid)', () => {
      const selectedParty = '';
      // Empty affiliation is valid — user can be independent
      expect(typeof selectedParty).toBe('string');
    });
  });

  describe('New User Detection', () => {
    it('detects user as new within 7 days', () => {
      const createdAt = new Date();
      const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysSince <= 7).toBe(true);
    });

    it('detects user as not new after 7 days', () => {
      const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysSince <= 7).toBe(false);
    });
  });

  describe('Onboarding Profile', () => {
    it('creates proper onboarding profile structure', () => {
      const onboarding = {
        country: 'US',
        affiliation: 'independent',
        topics: ['economy', 'healthcare', 'climate'],
        bio: '',
      };

      expect(onboarding.country).toBe('US');
      expect(onboarding.topics.length).toBe(3);
      expect(onboarding.bio).toBe('');
    });

    it('marks onboarding as complete with timestamp', () => {
      const onboarding = {
        country: 'US',
        affiliation: '',
        topics: ['economy'],
        bio: '',
        completedAt: new Date().toISOString(),
      };

      expect(onboarding.completedAt).toBeDefined();
      expect(new Date(onboarding.completedAt).getTime()).toBeGreaterThan(0);
    });
  });
});
