import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
import { toast } from "sonner";
import {
  createBookClub,
  deleteBookClub,
  getClubsHome,
  inviteClubMember,
  joinBookClub,
  leaveBookClub,
  requestJoinClub,
  respondClubInvite,
  reviewJoinRequest,
  updateBookClub,
  type BookClub,
  type ClubsHomeResponse,
  type CreateBookClubRequest,
} from "@/services/api";

export type {
  BookClub,
  ClubDetailResponse,
  ClubDiscussion,
  ClubInvite,
  ClubJoinRequest,
  ClubMedia,
  ClubMember,
  ClubMemberRole,
  ClubPreview,
  ClubsHomeResponse,
} from "@/services/api";

const emptyHome: ClubsHomeResponse = {
  myClubs: [],
  suggested: [],
  nearby: [],
  popular: [],
  newest: [],
  invites: [],
  pendingRequests: [],
  searchResults: [],
  summary: {
    my_clubs: 0,
    suggested: 0,
    nearby: 0,
    invites: 0,
    pending_requests: 0,
  },
};

const uniqueById = (items: BookClub[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const useBookClubs = (filters: { searchQuery?: string } = {}) => {
  const { user, loading: authLoading } = useAuth();
  const readerId = authLoading ? undefined : user?.id;
  const readerScope = useMemo(() => ({ readerId }), [readerId]);
  const activeScope = useRef(readerScope);
  activeScope.current = readerScope;
  const mounted = useRef(false);
  const createGeneration = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; createGeneration.current += 1; };
  }, [readerId]);
  const searchQuery = filters.searchQuery ?? "";
  const read = useCallback(() => getClubsHome({ searchQuery }), [searchQuery]);
  const resource = useRetainedReaderResource(user ? JSON.stringify([user.id, searchQuery]) : undefined, read);
  const home = resource.data ?? emptyHome;
  const clubs = useMemo(() => uniqueById([
    ...home.myClubs, ...home.suggested, ...home.nearby, ...home.popular,
    ...home.newest, ...home.invites, ...home.pendingRequests, ...home.searchResults,
  ]), [home]);
  const refresh = resource.refetch;
  const currentRefresh = useRef(refresh);
  currentRefresh.current = refresh;

  const createClub = async (clubData: CreateBookClubRequest) => {
    if (!readerId || !mounted.current || activeScope.current !== readerScope) {
      throw new Error("Your session changed. Reopen the club form to continue.");
    }
    const generation = createGeneration.current;
    const isCurrent = () => mounted.current && activeScope.current === readerScope && createGeneration.current === generation;
    let data: Awaited<ReturnType<typeof createBookClub>>;
    try {
      data = await createBookClub(clubData);
    } catch (error: unknown) {
      if (isCurrent()) {
        console.error("Error creating club:", error);
        toast.error("Failed to create book club");
      }
      throw error;
    }
    if (isCurrent()) {
      toast.success("Book club created");
      // Creation is already confirmed. A slower or failed list read has its
      // own retained-resource state and must not hold or fail this task.
      void currentRefresh.current();
    }
    return data;
  };

  const joinClub = async (clubId: string) => {
    try {
      await joinBookClub(clubId);
      toast.success("Joined book club");
      await refresh();
    } catch (error: unknown) {
      console.error("Error joining club:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join book club");
      throw error;
    }
  };

  const leaveClub = async (clubId: string) => {
    try {
      await leaveBookClub(clubId);
      toast.success("Left book club");
      await refresh();
    } catch (error: unknown) {
      console.error("Error leaving club:", error);
      toast.error(error instanceof Error ? error.message : "Failed to leave book club");
      throw error;
    }
  };

  const requestClub = async (clubId: string, message?: string) => {
    try {
      await requestJoinClub(clubId, message);
      toast.success("Join request sent");
      await refresh();
    } catch (error: unknown) {
      console.error("Error requesting club:", error);
      toast.error(error instanceof Error ? error.message : "Failed to request access");
      throw error;
    }
  };

  const respondInvite = async (inviteId: string, decision: "accept" | "decline") => {
    try {
      await respondClubInvite(inviteId, decision);
      toast.success(decision === "accept" ? "Invite accepted" : "Invite declined");
      await refresh();
    } catch (error: unknown) {
      console.error("Error responding to invite:", error);
      toast.error("Failed to respond to invite");
      throw error;
    }
  };

  const reviewRequest = async (requestId: string, decision: "approve" | "decline") => {
    try {
      await reviewJoinRequest(requestId, decision);
      toast.success(decision === "approve" ? "Request approved" : "Request declined");
      await refresh();
    } catch (error: unknown) {
      console.error("Error reviewing request:", error);
      toast.error("Failed to review request");
      throw error;
    }
  };

  const inviteMember = async (clubId: string, userId: string, message?: string) => {
    try {
      await inviteClubMember(clubId, userId, message);
      toast.success("Invite sent");
      await refresh();
    } catch (error: unknown) {
      console.error("Error inviting member:", error);
      toast.error(error instanceof Error ? error.message : "Failed to invite reader");
      throw error;
    }
  };

  const updateClub = async (clubId: string, updates: Partial<BookClub>) => {
    try {
      await updateBookClub(clubId, updates);
      toast.success("Club updated");
      await refresh();
    } catch (error: unknown) {
      console.error("Error updating club:", error);
      toast.error("Failed to update club");
      throw error;
    }
  };

  const deleteClub = async (clubId: string) => {
    try {
      await deleteBookClub(clubId);
      toast.success("Club deleted");
      await refresh();
    } catch (error: unknown) {
      console.error("Error deleting club:", error);
      toast.error("Failed to delete club");
      throw error;
    }
  };

  const sections = useMemo(
    () => ({
      myClubs: home.myClubs,
      suggested: home.suggested,
      nearby: home.nearby,
      popular: home.popular,
      newest: home.newest,
      invites: home.invites,
      pendingRequests: home.pendingRequests,
      searchResults: home.searchResults,
    }),
    [home],
  );

  return {
    clubs,
    home,
    sections,
    loading: authLoading || resource.loading,
    refreshing: resource.refreshing,
    error: resource.error,
    hasLoaded: resource.data !== undefined,
    fetchClubs: refresh,
    createClub,
    joinClub,
    leaveClub,
    requestClub,
    respondInvite,
    reviewRequest,
    inviteMember,
    updateClub,
    deleteClub,
  };
};
