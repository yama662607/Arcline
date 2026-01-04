import { describe, expect, it } from 'vitest';
import { detectImportFormat, parseNetscapeHtml, importBookmarks } from './bookmark-import';

describe('bookmark-import', () => {
  const sampleHtml = `
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
        <DT><H3>Bookmarks bar</H3>
        <DL><p>
            <DT><H3>Arc</H3>
            <DL><p>
                <DT><H3>Work Space</H3>
                <DL><p>
                    <DT><A HREF="https://google.com">Google</A>
                    <DT><H3>Project A</H3>
                    <DL><p>
                        <DT><A HREF="https://github.com">GitHub</A>
                    </DL><p>
                </DL><p>
            </DL><p>
        </DL><p>
    </DL><p>
  `;

  it('should detect HTML format', () => {
    expect(detectImportFormat(sampleHtml)).toBe('html');
  });

  it('should parse HTML structure', () => {
    const bookmarks = parseNetscapeHtml(sampleHtml);
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0]!.title).toBe('Bookmarks bar');
  });

  it('should unwrap containers in importBookmarks', () => {
    const result = importBookmarks(sampleHtml);
    expect(result.success).toBe(true);
    // Should skip "Bookmarks bar" and "Arc"
    expect(result.bookmarks.length).toBe(1);
    expect(result.bookmarks[0]!.title).toBe('Work Space');
    expect(result.bookmarks[0]!.children?.length).toBe(2); // Google and Project A
  });

  it('should parse Arc firebaseSyncState with spaceModels mapping', () => {
    const arcJson = JSON.stringify({
      firebaseSyncState: {
        syncData: {
          spaceModels: [
            {
              value: {
                id: 'SPACE-1',
                title: 'Daisuke',
                containerIDs: ['PINNED-1', 'UNPINNED-1'],
              },
            },
          ],
          items: [
            {
              value: {
                id: 'ITEM-1',
                parentID: 'PINNED-1',
                data: { tab: { savedURL: 'https://google.com', savedTitle: 'Google' } },
              },
            },
          ],
        },
      },
    });

    const result = importBookmarks(arcJson);
    expect(result.success).toBe(true);
    expect(result.bookmarks.length).toBe(1);
    expect(result.bookmarks[0]!.title).toBe('Daisuke');
    expect(result.bookmarks[0]!.children?.[0]?.title).toBe('Google');
  });

  it('should handle technical containers with null titles', () => {
    const arcJson = JSON.stringify({
      firebaseSyncState: {
        syncData: {
          items: [
            {
              value: {
                id: 'pinned',
                parentID: null,
                childrenIds: ['ITEM-1'],
              },
            },
            {
              value: {
                id: 'ITEM-1',
                parentID: 'pinned',
                data: { tab: { savedURL: 'https://google.com', savedTitle: 'Google' } },
              },
            },
          ],
        },
      },
    });

    const result = importBookmarks(arcJson);
    expect(result.success).toBe(true);
    // Should use "Pinned Tabs" for null title if ID is 'pinned'
    expect(result.bookmarks.some(b => b.title === 'Pinned Tabs')).toBe(true);
  });
});
