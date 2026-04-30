import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useAuth } from "@/hooks/useAuth";
import { useBadges } from "@/hooks/useBadges";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft } from "iconoir-react";
import { useIsMobile } from "@/hooks/use-mobile";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Badge, UserBadge } from "@/types";
import { BadgeDetailsDialog } from "@/components/BadgeDetailsDialog";
import { BRACK_TROPHY_IMAGE } from "@/config/brackAssets";

const Achievements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { badges, earnedBadges, loading } = useBadges(user?.id);
  const [filter, setFilter] = useState<'all' | 'earned' | 'unearned'>('all');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [selectedEarnedBadge, setSelectedEarnedBadge] = useState<UserBadge | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!user) {
    return null;
  }

  const earnedBadgeIds = new Set(earnedBadges.map(eb => eb.badge_id));
  const filteredBadges = badges.filter(badge => {
    const isEarned = earnedBadgeIds.has(badge.id);
    if (filter === 'earned') return isEarned;
    if (filter === 'unearned') return !isEarned;
    return true;
  });

  const earnedCount = earnedBadges.length;
  const totalCount = badges.length;
  const progressPercentage = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  const handleBadgeClick = (badge: Badge, earnedBadge?: UserBadge) => {
    if (!earnedBadge) return; // Only show details for earned badges
    setSelectedBadge(badge);
    setSelectedEarnedBadge(earnedBadge);
    setDetailsOpen(true);
  };

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Achievements" showBack />}
      
      <div className="app-page">
        {!isMobile && (
          <div className="mb-6 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-3xl font-bold">Achievements</h1>
              <p className="font-sans text-muted-foreground mt-1">
                Track your reading milestones and accomplishments
              </p>
            </div>
          </div>
        )}

        {/* Progress Overview */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-0">
            <div className="grid md:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="space-y-4 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Your Progress
                  </CardTitle>
                  <img
                    src={BRACK_TROPHY_IMAGE}
                    alt=""
                    aria-hidden="true"
                    className="h-16 w-16 shrink-0 rounded-md border border-border/70 object-cover md:hidden"
                    draggable={false}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-sans text-3xl font-bold text-primary">
                      {earnedCount} / {totalCount}
                    </div>
                    <div className="font-sans text-sm text-muted-foreground">
                      Badges Earned
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-sans text-3xl font-bold">{progressPercentage}%</div>
                    <div className="font-sans text-sm text-muted-foreground">Complete</div>
                  </div>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <div className="hidden border-l border-border/70 bg-muted/20 p-4 md:block">
                <img
                  src={BRACK_TROPHY_IMAGE}
                  alt=""
                  aria-hidden="true"
                  className="h-full min-h-40 w-full rounded-md object-cover"
                  draggable={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
            <TabsTrigger value="earned">Earned ({earnedCount})</TabsTrigger>
            <TabsTrigger value="unearned">Locked ({totalCount - earnedCount})</TabsTrigger>
          </TabsList>
          
          {/* Badges Grid */}
          <TabsContent value="all" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" text="Loading achievements..." />
              </div>
            ) : badges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <img
                    src={BRACK_TROPHY_IMAGE}
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mb-4 h-24 w-24 rounded-md object-cover opacity-80"
                    draggable={false}
                  />
                  <p className="font-sans text-muted-foreground">No badges available</p>
                </CardContent>
              </Card>
            ) : (
              <BadgeDisplay
                badges={badges}
                earnedBadges={earnedBadges}
                onBadgeClick={handleBadgeClick}
              />
            )}
          </TabsContent>
          
          <TabsContent value="earned" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" text="Loading achievements..." />
              </div>
            ) : earnedBadges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <img
                    src={BRACK_TROPHY_IMAGE}
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mb-4 h-24 w-24 rounded-md object-cover opacity-80"
                    draggable={false}
                  />
                  <p className="font-sans text-muted-foreground">
                    You haven't earned any badges yet. Keep reading!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <BadgeDisplay 
                badges={badges.filter(badge => earnedBadgeIds.has(badge.id))} 
                earnedBadges={earnedBadges}
                onBadgeClick={handleBadgeClick}
              />
            )}
          </TabsContent>
          
          <TabsContent value="unearned" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" text="Loading achievements..." />
              </div>
            ) : badges.filter(badge => !earnedBadgeIds.has(badge.id)).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <img
                    src={BRACK_TROPHY_IMAGE}
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mb-4 h-24 w-24 rounded-md object-cover opacity-80"
                    draggable={false}
                  />
                  <p className="font-sans text-muted-foreground">All badges earned!</p>
                </CardContent>
              </Card>
            ) : (
              <BadgeDisplay 
                badges={badges.filter(badge => !earnedBadgeIds.has(badge.id))} 
                earnedBadges={earnedBadges} 
                // Locked badges won't trigger details since earnedBadge will be undefined
                onBadgeClick={handleBadgeClick}
              />
            )}
          </TabsContent>
        </Tabs>

        {selectedBadge && (
          <BadgeDetailsDialog
            badge={selectedBadge}
            earnedBadge={selectedEarnedBadge}
            open={detailsOpen}
            onOpenChange={(open) => setDetailsOpen(open)}
          />
        )}
      </div>
    </MobileLayout>
  );
};

export default Achievements;
