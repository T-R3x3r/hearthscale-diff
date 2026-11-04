/**
 * What both views of the app keep: the review comments the chats on screen
 * hold as chips, how the tab draws its rows, and the places it has shown.
 */
import { useEffect, useRef, useState } from 'react';
import type { DiffSource, Direction, Host, Look } from './host.ts';
import { blockOf, reviewBlock, survives, type ReviewComment } from './review.ts';

/** The comments the chats on screen hold. A chip the person removed, or a
 *  message that took the chips, lets its comment go. */
export function useReview(host: Host) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const held = useRef(comments);
  held.current = comments;

  /** The comments the chats hold, which the view's context becomes. */
  const keep = (next: ReviewComment[]) => {
    setComments(next);
    void host.context(next.map(blockOf));
  };

  useEffect(
    () =>
      host.onHeld(() => {
        const texts = new Set(host.held().map((block) => block.text));
        setComments((all) => all.filter((c) => texts.has(reviewBlock(c))));
      }),
    [host],
  );

  return {
    /** Takes a comment, in place of one on the same rows. */
    add: (made: ReviewComment) => {
      const same = (c: ReviewComment) =>
        c.root === made.root &&
        c.section === made.section &&
        c.file === made.file &&
        c.range === made.range;
      keep([...held.current.filter((c) => !same(c)), made]);
    },
    /** Lets go of each comment a freshly read patch no longer anchors. */
    prune: (patch: string, source: DiffSource) => {
      const kept = held.current.filter((c) => survives(patch, source, c));
      if (kept.length !== held.current.length) keep(kept);
    },
  };
}

/** How the tab draws its rows, kept for the tab as the person changes it. */
export function useLook(host: Host): [Look, (next: Look) => void] {
  const [look, setLook] = useState<Look>(() => host.look());
  return [
    look,
    (next) => {
      setLook(next);
      void host.setLook(next);
    },
  ];
}

/** Back and forward through the places the tab has shown, in memory. `open`
 *  shows a place, and `exists` says whether one can still be shown. What
 *  comes back is the person's move to a place, which clears what lies
 *  forward. */
export function usePlaces<Place>(
  host: Host,
  at: Place | null,
  exists: (place: Place) => Promise<boolean>,
  open: (place: Place) => void,
): (next: Place) => void {
  const places = useRef<Record<Direction, Place[]>>({ back: [], forward: [] });
  const latest = useRef({ at, exists, open });
  latest.current = { at, exists, open };
  const same = (a: Place, b: Place) => JSON.stringify(a) === JSON.stringify(b);

  useEffect(() => {
    const walk = async (direction: Direction) => {
      const steps = places.current;
      while (steps[direction].length) {
        const place = steps[direction].pop()!;
        if (!(await latest.current.exists(place).catch(() => false))) continue;
        const { at, open } = latest.current;
        if (at && same(at, place)) continue;
        if (at) steps[direction === 'back' ? 'forward' : 'back'].push(at);
        open(place);
        // A step queued behind this one runs before the place renders.
        latest.current.at = place;
        return;
      }
    };
    let walking = Promise.resolve();
    host.onHistory((direction) => {
      walking = walking.then(() => walk(direction));
    });
  }, [host]);

  return (next) => {
    const { at, open } = latest.current;
    if (at && !same(at, next)) {
      places.current.back.push(at);
      places.current.forward = [];
    }
    open(next);
  };
}
