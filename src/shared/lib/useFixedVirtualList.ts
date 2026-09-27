import { type UIEvent, useCallback, useLayoutEffect, useRef, useState } from 'react';

interface FixedVirtualListOptions {
  count: number;
  enabled: boolean;
  itemHeight: number;
  overscan?: number;
}

const DEFAULT_VIEWPORT_HEIGHT = 640;

export function getFixedVirtualRange({
  count,
  itemHeight,
  overscan,
  scrollTop,
  viewportHeight,
}: {
  count: number;
  itemHeight: number;
  overscan: number;
  scrollTop: number;
  viewportHeight: number;
}) {
  const maximumScrollTop = Math.max(0, count * itemHeight - viewportHeight);
  const effectiveScrollTop = Math.min(scrollTop, maximumScrollTop);
  const startIndex = Math.max(
    0,
    Math.floor(effectiveScrollTop / itemHeight) - overscan,
  );
  const endIndex = Math.min(
    count,
    Math.ceil((effectiveScrollTop + viewportHeight) / itemHeight) + overscan,
  );

  return { endIndex, startIndex };
}

export function useFixedVirtualList({
  count,
  enabled,
  itemHeight,
  overscan = 4,
}: FixedVirtualListOptions) {
  const containerRef = useRef<HTMLElement>(null);
  const [viewport, setViewport] = useState({
    height: DEFAULT_VIEWPORT_HEIGHT,
    scrollTop: 0,
  });
  const range = enabled
    ? getFixedVirtualRange({
        count,
        itemHeight,
        overscan,
        scrollTop: viewport.scrollTop,
        viewportHeight: viewport.height,
      })
    : { startIndex: 0, endIndex: count };

  const updateViewport = useCallback(
    (element: HTMLElement) => {
      const nextViewport = {
        height: element.clientHeight || DEFAULT_VIEWPORT_HEIGHT,
        scrollTop: element.scrollTop,
      };
      setViewport((current) =>
        current.height === nextViewport.height &&
        current.scrollTop === nextViewport.scrollTop
          ? current
          : nextViewport,
      );
    },
    [setViewport],
  );

  const onScroll = useCallback(
    (event: UIEvent<HTMLElement>) => updateViewport(event.currentTarget),
    [updateViewport],
  );

  const scrollToStart = useCallback(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = 0;
    updateViewport(element);
  }, [updateViewport]);

  useLayoutEffect(() => {
    const element = containerRef.current;

    if (!element || !enabled || !('ResizeObserver' in window)) {
      return undefined;
    }

    const observer = new ResizeObserver(() => updateViewport(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, updateViewport]);

  return {
    containerRef,
    endIndex: range.endIndex,
    itemHeight,
    onScroll,
    scrollToStart,
    startIndex: range.startIndex,
    totalHeight: count * itemHeight,
  };
}
