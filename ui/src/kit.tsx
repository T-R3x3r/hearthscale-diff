/**
 * The parts the view draws, built on the kit Hearthscale loads into every
 * view: its `hs-*` classes, which give each part the look of the same part
 * in the shell, and the Remix Icon font with its `ri-*` classes.
 */
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';

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
