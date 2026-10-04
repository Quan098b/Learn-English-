"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate } from "../../lib/router";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Same-origin link that navigates without a full page load. */
export function Link({ href, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      rest.target === "_blank"
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
