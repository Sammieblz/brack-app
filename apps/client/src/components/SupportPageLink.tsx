import { useRef, type ComponentProps, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isDesktopRuntime, isMobileNativeRuntime, openSupportPage, type SupportPageSection } from "@/services/platform";

type SupportPageLinkProps = Omit<ComponentProps<typeof Link>, "to"> & {
  section?: SupportPageSection;
  beforeNavigate?: (action: () => void) => void | Promise<void>;
};

export const SupportPageLink = ({ section, onClick, beforeNavigate, ...props }: SupportPageLinkProps) => {
  const navigate = useNavigate();
  const opening = useRef(false);
  const to = `/support${section ? `#${section}` : ""}`;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const native = isDesktopRuntime() || isMobileNativeRuntime();
    if (!native && (!beforeNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;

    event.preventDefault();
    const activate = () => {
      if (!native) { navigate(to); return; }
      if (opening.current) return;
      opening.current = true;
      void openSupportPage(section)
        .then((opened) => {
          if (!opened) navigate(to);
        })
        .finally(() => { opening.current = false; });
    };
    if (beforeNavigate) void beforeNavigate(activate);
    else activate();
  };

  return <Link {...props} to={to} onClick={handleClick} />;
};
