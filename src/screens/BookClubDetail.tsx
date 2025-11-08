import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClubDiscussions } from "@/hooks/useClubDiscussions";
import { DiscussionThread } from "@/components/clubs/DiscussionThread";
import { supabase } from "@/integrations/supabase/client";
import { BookClub, ClubMember } from "@/hooks/useBookClubs";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Users, MessageSquare, BookOpen, ArrowLeft, Send, Crown, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

const BookClubDetail = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<BookClub | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionContent, setNewDiscussionContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { discussions, loading: discussionsLoading, createDiscussion, deleteDiscussion } = useClubDiscussions(clubId!);

  useEffect(() => {
    fetchClubDetails();
    fetchMembers();
    getCurrentUser();
  }, [clubId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id);
  };

  const fetchClubDetails = async () => {
    if (!clubId) return;

    try {
      const { data, error } = await supabase
        .from('book_clubs')
        .select('*')
        .eq('id', clubId)
        .single();

      if (error) throw error;

      // Fetch current book if exists
      if (data.current_book_id) {
        const { data: bookData } = await supabase
          .from('books')
          .select('id, title, author, cover_url')
          .eq('id', data.current_book_id)
          .single();

        setClub({ ...data, current_book: bookData });
      } else {
        setClub(data);
      }
    } catch (error) {
      console.error('Error fetching club:', error);
      toast.error('Failed to load club details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!clubId) return;

    try {
      const { data, error } = await supabase
        .from('book_club_members')
        .select('*')
        .eq('club_id', clubId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles
      const userIds = data?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedMembers = (data?.map(member => ({
        ...member,
        role: member.role as 'admin' | 'moderator' | 'member',
        user: profileMap.get(member.user_id),
      })) || []) as ClubMember[];

      setMembers(enrichedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscussionContent.trim()) return;

    try {
      setSubmitting(true);
      await createDiscussion({
        title: newDiscussionTitle.trim() || undefined,
        content: newDiscussionContent,
      });
      setNewDiscussionTitle("");
      setNewDiscussionContent("");
    } catch (error) {
      console.error('Error creating discussion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    await createDiscussion({
      content,
      parent_id: parentId,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground">Club not found</p>
          </div>
        </div>
      </div>
    );
  }

  const userMember = members.find(m => m.user_id === currentUserId);
  const isAdmin = userMember?.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/clubs')}
          className="mb-6 hover-scale"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clubs
        </Button>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="md:col-span-2">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{club.name}</CardTitle>
                    <p className="text-muted-foreground">{club.description}</p>
                  </div>
                  {club.cover_image_url && (
                    <img
                      src={club.cover_image_url}
                      alt={club.name}
                      className="w-20 h-20 object-cover rounded-lg shadow-sm"
                    />
                  )}
                </div>
              </CardHeader>
              {club.current_book && (
                <CardContent>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Currently Reading</span>
                    </div>
                    <div className="flex gap-4">
                      {club.current_book.cover_url && (
                        <img
                          src={club.current_book.cover_url}
                          alt={club.current_book.title}
                          className="w-20 h-28 object-cover rounded shadow-md"
                        />
                      )}
                      <div>
                        <h4 className="font-semibold text-lg">{club.current_book.title}</h4>
                        {club.current_book.author && (
                          <p className="text-muted-foreground">by {club.current_book.author}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-primary/20">
                      <AvatarImage src={member.user?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-xs">
                        {member.user?.display_name ? getInitials(member.user.display_name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user?.display_name || 'Unknown User'}
                      </p>
                      {member.role === 'admin' && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Crown className="h-3 w-3" />
                          Admin
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="discussions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="discussions" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Discussions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discussions" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Start a Discussion</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDiscussion} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title (optional)</Label>
                    <Input
                      id="title"
                      value={newDiscussionTitle}
                      onChange={(e) => setNewDiscussionTitle(e.target.value)}
                      placeholder="Discussion topic..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Message *</Label>
                    <Textarea
                      id="content"
                      value={newDiscussionContent}
                      onChange={(e) => setNewDiscussionContent(e.target.value)}
                      placeholder="Share your thoughts..."
                      rows={4}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={submitting || !newDiscussionContent.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    {submitting ? 'Posting...' : 'Post Discussion'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {discussionsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : discussions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No discussions yet. Start the conversation!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {discussions.map((discussion) => (
                  <DiscussionThread
                    key={discussion.id}
                    discussion={discussion}
                    onReply={handleReply}
                    onDelete={deleteDiscussion}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default BookClubDetail;
