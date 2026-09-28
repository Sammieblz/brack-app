import type { ReactNode } from 'react';
export const MobileLayout = ({ children }: { children: ReactNode }) => <div>{children}</div>;
export const MobileHeader = ({ title }: { title: string }) => <h1 className="px-4 text-xl">{title}</h1>;
export const FollowAction = () => <span>Fixture follow control</span>;
export const PostCard = () => <article>Fixture post</article>;
