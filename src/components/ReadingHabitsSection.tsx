import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Edit2, Save, X } from "lucide-react";

const GENRES = [
  "Fiction", "Non-Fiction", "Mystery", "Thriller", "Science Fiction",
  "Fantasy", "Romance", "Biography", "History", "Self-Help",
  "Business", "Philosophy", "Poetry", "Young Adult", "Horror"
];

interface ReadingHabits {
  avg_time_per_book: number | null;
  avg_length: number | null;
  books_6mo: number | null;
  books_1yr: number | null;
  genres: string[] | null;
  longest_genre: string | null;
}

interface ReadingHabitsSectionProps {
  userId: string;
}

export const ReadingHabitsSection = ({ userId }: ReadingHabitsSectionProps) => {
  const [habits, setHabits] = useState<ReadingHabits | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    avg_time_per_book: "",
    avg_length: "",
    books_6mo: "",
    books_1yr: "",
    genres: [] as string[],
    longest_genre: "",
  });

  useEffect(() => {
    loadHabits();
  }, [userId]);

  const loadHabits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reading_habits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setHabits(data);
        setFormData({
          avg_time_per_book: data.avg_time_per_book?.toString() || "",
          avg_length: data.avg_length?.toString() || "",
          books_6mo: data.books_6mo?.toString() || "",
          books_1yr: data.books_1yr?.toString() || "",
          genres: data.genres || [],
          longest_genre: data.longest_genre || "",
        });
      }
    } catch (error: unknown) {
      console.error('Error loading reading habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        user_id: userId,
        avg_time_per_book: formData.avg_time_per_book ? parseInt(formData.avg_time_per_book) : null,
        avg_length: formData.avg_length ? parseInt(formData.avg_length) : null,
        books_6mo: formData.books_6mo ? parseInt(formData.books_6mo) : null,
        books_1yr: formData.books_1yr ? parseInt(formData.books_1yr) : null,
        genres: formData.genres,
        longest_genre: formData.longest_genre || null,
      };

      const { error } = await supabase
        .from('reading_habits')
        .upsert(updateData);

      if (error) throw error;

      toast({
        title: "Reading habits updated",
        description: "Your reading preferences have been saved successfully",
      });
      
      setIsEditing(false);
      loadHabits();
    } catch (error: unknown) {
      console.error('Error updating reading habits:', error);
      toast({
        variant: "destructive",
        title: "Error updating reading habits",
        description: error instanceof Error ? error.message : "Failed to update reading habits",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Reading Habits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-sans text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Reading Habits
          </CardTitle>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  loadHabits();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!habits && !isEditing ? (
          <div className="text-center py-8">
            <p className="font-sans text-muted-foreground mb-4">
              No reading habits recorded yet
            </p>
            <Button onClick={() => setIsEditing(true)}>
              Add Reading Habits
            </Button>
          </div>
        ) : isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="avg_time">Average days per book</Label>
                <Input
                  id="avg_time"
                  type="number"
                  value={formData.avg_time_per_book}
                  onChange={(e) => setFormData(prev => ({ ...prev, avg_time_per_book: e.target.value }))}
                  placeholder="e.g., 14"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avg_length">Average book length (pages)</Label>
                <Input
                  id="avg_length"
                  type="number"
                  value={formData.avg_length}
                  onChange={(e) => setFormData(prev => ({ ...prev, avg_length: e.target.value }))}
                  placeholder="e.g., 300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="books_6mo">Books read in last 6 months</Label>
                <Input
                  id="books_6mo"
                  type="number"
                  value={formData.books_6mo}
                  onChange={(e) => setFormData(prev => ({ ...prev, books_6mo: e.target.value }))}
                  placeholder="e.g., 6"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="books_1yr">Books read in last year</Label>
                <Input
                  id="books_1yr"
                  type="number"
                  value={formData.books_1yr}
                  onChange={(e) => setFormData(prev => ({ ...prev, books_1yr: e.target.value }))}
                  placeholder="e.g., 12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Favorite Genres</Label>
              <p className="font-sans text-sm text-muted-foreground mb-2">
                Select all genres you enjoy reading
              </p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <Badge
                    key={genre}
                    variant={formData.genres.includes(genre) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="longest_genre">Which genre takes longest to read?</Label>
              <Select
                value={formData.longest_genre}
                onValueChange={(value) => setFormData(prev => ({ ...prev, longest_genre: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-sans text-sm text-muted-foreground">Avg. days per book</p>
                <p className="font-sans text-lg font-semibold">{habits?.avg_time_per_book || "N/A"} days</p>
              </div>
              <div>
                <p className="font-sans text-sm text-muted-foreground">Avg. book length</p>
                <p className="font-sans text-lg font-semibold">{habits?.avg_length || "N/A"} pages</p>
              </div>
              <div>
                <p className="font-sans text-sm text-muted-foreground">Books (6 months)</p>
                <p className="font-sans text-lg font-semibold">{habits?.books_6mo || 0}</p>
              </div>
              <div>
                <p className="font-sans text-sm text-muted-foreground">Books (1 year)</p>
                <p className="font-sans text-lg font-semibold">{habits?.books_1yr || 0}</p>
              </div>
            </div>

            {habits?.genres && habits.genres.length > 0 && (
              <div>
                <p className="font-sans text-sm text-muted-foreground mb-2">Favorite Genres</p>
                <div className="flex flex-wrap gap-2">
                  {habits.genres.map((genre) => (
                    <Badge key={genre} variant="secondary">{genre}</Badge>
                  ))}
                </div>
              </div>
            )}

            {habits?.longest_genre && (
              <div>
                <p className="font-sans text-sm text-muted-foreground">Takes longest to read</p>
                <Badge variant="outline" className="mt-1">{habits.longest_genre}</Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
