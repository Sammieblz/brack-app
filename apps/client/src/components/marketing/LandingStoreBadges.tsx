import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import "./landing-store-badges.css";

interface LandingStoreBadgesProps {
  appStoreUrl?: string;
  googlePlayUrl?: string;
  className?: string;
}

// Brand marks sourced from Apple's global navigation and Google Play's header:
// https://www.apple.com/ and https://play.google.com/store/apps
const AppleMark = () => (
  <svg className="landing-store-badge__mark" viewBox="0 12 14 17" fill="currentColor" aria-hidden="true">
    <path d="m13.0729 17.6825a3.61 3.61 0 0 0 -1.7248 3.0365 3.5132 3.5132 0 0 0 2.1379 3.2223 8.394 8.394 0 0 1 -1.0948 2.2618c-.6816.9812-1.3943 1.9623-2.4787 1.9623s-1.3633-.63-2.613-.63c-1.2187 0-1.6525.6507-2.644.6507s-1.6834-.9089-2.4787-2.0243a9.7842 9.7842 0 0 1 -1.6628-5.2776c0-3.0984 2.014-4.7405 3.9969-4.7405 1.0535 0 1.9314.6919 2.5924.6919.63 0 1.6112-.7333 2.8092-.7333a3.7579 3.7579 0 0 1 3.1604 1.5802zm-3.7284-2.8918a3.5615 3.5615 0 0 0 .8469-2.22 1.5353 1.5353 0 0 0 -.031-.32 3.5686 3.5686 0 0 0 -2.3445 1.2084 3.4629 3.4629 0 0 0 -.8779 2.1585 1.419 1.419 0 0 0 .031.2892 1.19 1.19 0 0 0 .2169.0207 3.0935 3.0935 0 0 0 2.1586-1.1368z" />
  </svg>
);

const GooglePlayMark = () => (
  <svg className="landing-store-badge__mark" viewBox="0 0 40 40" aria-hidden="true">
    <path
      d="M19.7,19.2L4.3,35.3c0,0,0,0,0,0c0.5,1.7,2.1,3,4,3c0.8,0,1.5-0.2,2.1-0.6l0,0l17.4-9.9L19.7,19.2z"
      fill="#EA4335"
    />
    <path
      d="M35.3,16.4L35.3,16.4l-7.5-4.3l-8.4,7.4l8.5,8.3l7.5-4.2c1.3-0.7,2.2-2.1,2.2-3.6C37.5,18.5,36.6,17.1,35.3,16.4z"
      fill="#FBBC04"
    />
    <path d="M4.3,4.7C4.2,5,4.2,5.4,4.2,5.8v28.5c0,0.4,0,0.7,0.1,1.1l16-15.7L4.3,4.7z" fill="#4285F4" />
    <path d="M19.8,20l8-7.9L10.5,2.3C9.9,1.9,9.1,1.7,8.3,1.7c-1.9,0-3.6,1.3-4,3c0,0,0,0,0,0L19.8,20z" fill="#34A853" />
  </svg>
);

/** Real store URLs turn the launch placeholders into ordinary same-tab links. */
export const LandingStoreBadges = ({ appStoreUrl, googlePlayUrl, className }: LandingStoreBadgesProps) => {
  const statusId = useId();
  const [announcement, setAnnouncement] = useState("");
  const stores = [
    {
      name: "App Store",
      url: appStoreUrl,
      availableLabel: "Download on the",
      mark: <AppleMark />,
      message: "Brack for iPhone and iPad is coming soon. You can use Brack in your browser today.",
    },
    {
      name: "Google Play",
      url: googlePlayUrl,
      availableLabel: "Get it on",
      mark: <GooglePlayMark />,
      message: "Brack for Android is coming soon. You can use Brack in your browser today.",
    },
  ];

  return (
    <div className={cn("landing-store-badges", className)}>
      <div className="landing-store-badges__row" role="group" aria-label="Download Brack">
        {stores.map((store) => {
          const content = (
            <>
              {store.mark}
              <span className="landing-store-badge__copy">
                <span className="landing-store-badge__eyebrow">
                  {store.url ? store.availableLabel : "Coming soon on"}
                </span>
                <span className="landing-store-badge__name">{store.name}</span>
              </span>
            </>
          );

          return store.url ? (
            <a key={store.name} className="landing-store-badge" href={store.url}>
              {content}
            </a>
          ) : (
            <button
              key={store.name}
              type="button"
              className="landing-store-badge"
              aria-describedby={statusId}
              onClick={() => setAnnouncement(store.message)}
            >
              {content}
            </button>
          );
        })}
      </div>
      <p id={statusId} className="landing-store-badges__status" role="status" aria-atomic="true">
        {announcement ||
          (!appStoreUrl || !googlePlayUrl ? "App downloads are on their way. Start reading on the web today." : "")}
      </p>
    </div>
  );
};
