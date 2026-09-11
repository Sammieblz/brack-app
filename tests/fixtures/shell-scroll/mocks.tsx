import { useState } from 'react';
import { Sidebar, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import { JourneyLeague as RealJourneyLeague } from '../../../apps/client/src/components/journey/JourneyLeague';

// Only unrelated overlays and non-League Journey panels are replaced. The routed
// screens, layout, headers, scroll utilities, tabs and Library views stay real.
export function AppSidebar() {
  return <Sidebar collapsible="icon"><SidebarContent><SidebarTrigger aria-label="Toggle sidebar" /></SidebarContent></Sidebar>;
}
export const HeaderTimerWidget = () => <button type="button" aria-label="Reading timer" className="h-10 w-10 rounded-full">◷</button>;
export const UserNotificationsPopover = () => <button type="button" aria-label="Notifications" className="h-10 w-10 rounded-full">•</button>;
export const ProfileDrawer = () => null;
export const AddToListDialog = () => null;
export const BadgeDetailsDialog = () => null;
export const FloatingActionButton = () => null;
export const JourneyFreshnessNotice = () => null;
export const JourneyQuestBookPicker = () => null;

function JourneyContent() {
  const [late, setLate] = useState(false);
  return <div data-fixture-journey-content>
    <button type="button" onClick={() => setLate(true)}>Load additional reading history</button>
    {Array.from({ length: late ? 25 : 15 }, (_, index) => <article key={index} className="min-h-32 border-b p-6">
      <h2 className="font-display text-2xl">Reading milestone {index + 1}</h2>
      <p>Your progress remains anchored while the header stays in place.</p>
    </article>)}
  </div>;
}
export const JourneyOverview = JourneyContent;
export const JourneyQuests = JourneyContent;
export const JourneyShop = JourneyContent;
export const JourneyBadges = JourneyContent;
export const JourneyLeague = RealJourneyLeague;
