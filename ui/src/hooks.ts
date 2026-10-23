/**
 * What both views of the app keep: the review comments the chats on screen
 * hold as chips, and how the tab draws its rows.
 */
import { useEffect, useRef, useState } from 'react';
import type { Host, Look } from './host.ts';
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
        c.root === made.root && c.file === made.file && c.range === made.range;
      keep([...held.current.filter((c) => !same(c)), made]);
    },
    /** Lets go of each comment a freshly read patch no longer anchors. */
    prune: (patch: string, source: { root: string; paths?: string[] }) => {
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
