import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useAuth } from "@/hooks/useAuth";
import { useBadges } from "@/hooks/useBadges";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft } from "iconoir-react";
import { useIsMobile } from "@/hooks/use-mobile";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Badge, UserBadge } from "@/types";
import { BadgeDetailsDialog } from "@/components/BadgeDetailsDialog";

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
      
      <div className="container max-w-6xl mx-auto p-4 md:p-6">
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
        <Card className="mb-6 bg-gradient-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
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
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
