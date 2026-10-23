/**
 * The parts the view draws, built on the kit Hearthscale loads into every
 * view: its `hs-*` classes, which give each part the look of the same part
 * in the shell, and the Remix Icon font with its `ri-*` classes.
 */
import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { safeTriangle } from './safeTriangle.ts';

/** A Remix Icon by its remixicon.com name, at a size in pixels, in the
 *  colour of the text around it. */
export function Icon({
  name,
  size,
  className,
}: {
  name: string;
  size: number;
  className?: string;
}) {
  return (
    <i
      aria-hidden="true"
      className={`ri-${name} diff-glyph${className ? ` ${className}` : ''}`}
      style={{ fontSize: size }}
    />
  );
}

/** The square button of the view's toolbar. */
export function StripButton({
  onClick,
  children,
}: {
  onClick: (e: ReactMouseEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  return (
    <span onClick={onClick} className="hs-hovbox-ink hs-tipwrap hs-inkdim hs-panel-button">
      {children}
    </span>
  );
}

/** One row of a menu: a mark, a label with an optional line under it, the
 *  chosen one marked. A disabled row stays readable and inert. */
export function MItem({
  icon,
  label,
  sub,
  selected,
  disabled,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  sub?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="menuitem"
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      className={`hs-mitem hs-menu-item-row ${disabled ? 'hs-inkdim' : 'hs-inkmut hs-hovbox-ink'}`}
      data-sel={selected ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      onClick={disabled ? undefined : onClick}
    >
      {icon}
      <span className="hs-menu-label">
        <span className="hs-menu-title">{label}</span>
        {sub && <span className="hs-menu-sub">{sub}</span>}
      </span>
    </div>
  );
}

/** A hairline between the groups of a menu. */
export function MDivider() {
  return <div className="hs-menu-divider" />;
}

/** A sentence in the middle of the view: an empty state, or why there is
 *  nothing to read. */
export function DiffNote({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="hs-rview hs-panel-refusal">
      <div className="hs-panel-refusal-content">
        <Icon name="git-branch-line" size={20} className="hs-panel-muted-icon" />
        <span className="hs-panel-refusal-text">{text}</span>
        {children}
      </div>
    </div>
  );
}

/** A choice on the toolbar, which opens its list under it. */
export function BarChoice({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: (e: ReactMouseEvent<HTMLElement>) => void;
}) {
  return (
    <span
      onClick={onClick}
      className={`hs-hovbox-ink hs-inkmut hs-panel-picker${open ? ' hs-boxsel' : ''}`}
    >
      <span className="hs-panel-branch-name">{label}</span>
      <Icon name="arrow-down-s-line" size={10} className="hs-panel-fixed-icon" />
    </span>
  );
}

/** The list a bar choice opens, under it. It stays open while the pointer
 *  is on the bar choice, on the list or on the way between them, and
 *  closes when the pointer is anywhere else. */
export function PickerList({
  trigger,
  onLeave,
  children,
}: {
  trigger: HTMLElement;
  onLeave: () => void;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => safeTriangle(trigger, () => list.current!, onLeave), [trigger]);
  return (
    <div className="hs-panel-picker-popover">
      <div ref={list} className="hs-menu hs-panel-menu hs-panel-action-menu">
        {children}
      </div>
    </div>
  );
}
