import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Xmark } from "iconoir-react";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import { AppBackButton } from "@/components/AppBackButton";

type QuestionnaireTransition = {
  to: string;
  message: string;
};

const GENRES = [
  "Fiction", "Non-Fiction", "Mystery", "Romance", "Sci-Fi", "Fantasy", 
  "Biography", "History", "Self-Help", "Business", "Poetry", "Thriller",
  "Horror", "Comedy", "Drama", "Philosophy", "Religion", "Science"
];

const Questionnaire = () => {
  const [avgTimePerBook, setAvgTimePerBook] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [avgLength, setAvgLength] = useState("");
  const [books6mo, setBooks6mo] = useState("");
  const [books1yr, setBooks1yr] = useState("");
  const [longestGenre, setLongestGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [transition, setTransition] = useState<QuestionnaireTransition | null>(null);
  const { toast } = useToast();

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('reading_habits')
        .insert({
          user_id: user.id,
          avg_time_per_book: parseInt(avgTimePerBook) || null,
          genres: selectedGenres,
          avg_length: parseInt(avgLength) || null,
          books_6mo: parseInt(books6mo) || null,
          books_1yr: parseInt(books1yr) || null,
          longest_genre: longestGenre || null,
        });

      if (error) throw error;

      toast({
        title: "Reading habits saved!",
        description: "Let's set up your reading goals.",
      });

      setTransition({
        to: "/goals",
        message: "Saving your reading profile...",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error saving habits",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (transition) {
    return <BrandedRouteTransition to={transition.to} message={transition.message} />;
  }

  return (
    <div className="flex min-h-app-viewport items-center justify-center bg-background px-4 py-8 safe-top safe-bottom md:px-8">
      <Card className="w-full max-w-2xl lg:max-w-4xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-2">
              <ThemeAwareLogo variant="icon" tone="theme" size="h-8 w-8" className="drop-shadow-sm" />
              <span className="font-display text-xl font-bold text-primary">BRACK</span>
            </div>
          </div>
          <CardTitle className="font-display">Tell us about your reading habits</CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="avgTime">Average time to read a book (days)</Label>
                <Input
                  id="avgTime"
                  type="number"
                  placeholder="e.g., 14"
                  value={avgTimePerBook}
                  onChange={(e) => setAvgTimePerBook(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="avgLength">Average book length (pages)</Label>
                <Input
                  id="avgLength"
                  type="number"
                  placeholder="e.g., 300"
                  value={avgLength}
                  onChange={(e) => setAvgLength(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="books6mo">Books read in last 6 months</Label>
                <Input
                  id="books6mo"
                  type="number"
                  placeholder="e.g., 12"
                  value={books6mo}
                  onChange={(e) => setBooks6mo(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="books1yr">Books read in last year</Label>
                <Input
                  id="books1yr"
                  type="number"
                  placeholder="e.g., 24"
                  value={books1yr}
                  onChange={(e) => setBooks1yr(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <Label>What genres do you enjoy?</Label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <Badge
                    key={genre}
                    variant={selectedGenres.includes(genre) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleGenreToggle(genre)}
                  >
                    {genre}
                    {selectedGenres.includes(genre) && (
                      <Xmark className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="longestGenre">Which genre takes you longest to read?</Label>
              <Select value={longestGenre} onValueChange={setLongestGenre}>
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
            
            <div className="flex gap-4 pt-4">
              <AppBackButton
                label="Back"
                ariaLabel="Back to welcome"
                to="/welcome"
                showLabel
                variant="outline"
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Saving..." : "Continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Questionnaire;
