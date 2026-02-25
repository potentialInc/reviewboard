import { describe, it, expect } from 'vitest';
import { getOpenFeedbackCountByProject, getOpenFeedbackCountByScreen } from '@/lib/feedback-count';

// Build a mock supabase client that supports chaining: from().select().eq().in()
function createMockSupabase(tableData: Record<string, unknown[]>) {
  const supabase = {
    from: (table: string) => {
      const data = tableData[table] || [];
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.in = () => ({ data });
      return chain;
    },
  };
  return supabase as never;
}

describe('feedback-count', () => {
  describe('getOpenFeedbackCountByProject', () => {
    it('should return empty object when no projects have screens', async () => {
      const supabase = createMockSupabase({});
      const result = await getOpenFeedbackCountByProject(supabase, [
        { id: 'p1', screens: [] },
      ]);
      expect(result).toEqual({});
    });

    it('should return empty object when projects array is empty', async () => {
      const supabase = createMockSupabase({});
      const result = await getOpenFeedbackCountByProject(supabase, []);
      expect(result).toEqual({});
    });

    it('should return empty object when no open comments exist', async () => {
      const supabase = createMockSupabase({
        comments: [],
      });
      const result = await getOpenFeedbackCountByProject(supabase, [
        { id: 'p1', screens: [{ id: 's1' }] },
      ]);
      expect(result).toEqual({});
    });

    it('should count open feedback per project using joined query', async () => {
      // The new code uses: comments.select('screenshot_version:screenshot_versions!inner(screen_id)').eq().in()
      // Each returned comment has screenshot_version: { screen_id }
      const supabase = createMockSupabase({
        comments: [
          { screenshot_version: { screen_id: 's1' } },
          { screenshot_version: { screen_id: 's1' } },
          { screenshot_version: { screen_id: 's2' } },
        ],
      });

      const result = await getOpenFeedbackCountByProject(supabase, [
        { id: 'p1', screens: [{ id: 's1' }] },
        { id: 'p2', screens: [{ id: 's2' }] },
      ]);

      expect(result).toEqual({ p1: 2, p2: 1 });
    });

    it('should aggregate counts across multiple screens in same project', async () => {
      const supabase = createMockSupabase({
        comments: [
          { screenshot_version: { screen_id: 's1' } },
          { screenshot_version: { screen_id: 's2' } },
        ],
      });

      const result = await getOpenFeedbackCountByProject(supabase, [
        { id: 'p1', screens: [{ id: 's1' }, { id: 's2' }] },
      ]);

      expect(result).toEqual({ p1: 2 });
    });

    it('should handle projects without screens property', async () => {
      const supabase = createMockSupabase({});
      const result = await getOpenFeedbackCountByProject(supabase, [
        { id: 'p1' },
      ]);
      expect(result).toEqual({});
    });

    it('should handle array screenshot_version format', async () => {
      // Some Supabase joins return arrays
      const supabase = createMockSupabase({
        comments: [
          { screenshot_version: [{ screen_id: 's1' }] },
        ],
      });

      const result = await getOpenFeedbackCountByProject(supabase, [
        { id: 'p1', screens: [{ id: 's1' }] },
      ]);

      expect(result).toEqual({ p1: 1 });
    });
  });

  describe('getOpenFeedbackCountByScreen', () => {
    it('should return empty object when no screens have screenshot_versions', async () => {
      const supabase = createMockSupabase({});
      const result = await getOpenFeedbackCountByScreen(supabase, [
        { id: 's1', screenshot_versions: [] },
      ]);
      expect(result).toEqual({});
    });

    it('should return empty object for empty screens array', async () => {
      const supabase = createMockSupabase({});
      const result = await getOpenFeedbackCountByScreen(supabase, []);
      expect(result).toEqual({});
    });

    it('should count open feedback per screen', async () => {
      const supabase = createMockSupabase({
        comments: [
          { screenshot_version_id: 'sv1' },
          { screenshot_version_id: 'sv1' },
          { screenshot_version_id: 'sv2' },
        ],
      });

      const result = await getOpenFeedbackCountByScreen(supabase, [
        { id: 's1', screenshot_versions: [{ id: 'sv1' }] },
        { id: 's2', screenshot_versions: [{ id: 'sv2' }] },
      ]);

      expect(result).toEqual({ s1: 2, s2: 1 });
    });

    it('should aggregate counts across multiple versions in same screen', async () => {
      const supabase = createMockSupabase({
        comments: [
          { screenshot_version_id: 'sv1' },
          { screenshot_version_id: 'sv2' },
        ],
      });

      const result = await getOpenFeedbackCountByScreen(supabase, [
        { id: 's1', screenshot_versions: [{ id: 'sv1' }, { id: 'sv2' }] },
      ]);

      expect(result).toEqual({ s1: 2 });
    });

    it('should not include screens with zero open feedback', async () => {
      const supabase = createMockSupabase({
        comments: [],
      });

      const result = await getOpenFeedbackCountByScreen(supabase, [
        { id: 's1', screenshot_versions: [{ id: 'sv1' }] },
      ]);

      expect(result).toEqual({});
    });

    it('should handle screens without screenshot_versions property', async () => {
      const supabase = createMockSupabase({});
      const result = await getOpenFeedbackCountByScreen(supabase, [
        { id: 's1' },
      ]);
      expect(result).toEqual({});
    });
  });
});
