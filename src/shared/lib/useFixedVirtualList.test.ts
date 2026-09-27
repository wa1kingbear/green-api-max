import { getFixedVirtualRange } from './useFixedVirtualList';

describe('getFixedVirtualRange', () => {
  it('adds overscan around the visible items', () => {
    expect(
      getFixedVirtualRange({
        count: 100,
        itemHeight: 80,
        overscan: 3,
        scrollTop: 1_600,
        viewportHeight: 640,
      }),
    ).toEqual({ startIndex: 17, endIndex: 31 });
  });

  it('clamps the range when the list becomes shorter', () => {
    expect(
      getFixedVirtualRange({
        count: 5,
        itemHeight: 80,
        overscan: 3,
        scrollTop: 4_000,
        viewportHeight: 240,
      }),
    ).toEqual({ startIndex: 0, endIndex: 5 });
  });
});
