import { useRef, type ComponentProps, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isDesktopRuntime, isMobileNativeRuntime, openSupportPage, type SupportPageSection } from "@/services/platform";

type SupportPageLinkProps = Omit<ComponentProps<typeof Link>, "to"> & {
  section?: SupportPageSection;
};

export const SupportPageLink = ({ section, onClick, ...props }: SupportPageLinkProps) => {
  const navigate = useNavigate();
  const opening = useRef(false);
  const to = `/support${section ? `#${section}` : ""}`;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || (!isDesktopRuntime() && !isMobileNativeRuntime())) return;

    event.preventDefault();
    if (opening.current) return;
    opening.current = true;
    void openSupportPage(section)
      .then((opened) => {
        if (!opened) navigate(to);
      })
      .finally(() => { opening.current = false; });
  };

  return <Link {...props} to={to} onClick={handleClick} />;
};
