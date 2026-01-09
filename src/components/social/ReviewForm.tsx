import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useReviews } from "@/hooks/useReviews";
import { Star } from "lucide-react";
import { sanitizeInput } from "@/utils/sanitize";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().max(200, "Title must be less than 200 characters").optional(),
  content: z.string().min(10, "Review must be at least 10 characters").max(5000, "Review must be less than 5000 characters"),
  is_spoiler: z.boolean().default(false),
  is_public: z.boolean().default(true),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  bookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReviewForm = ({ bookId, open, onOpenChange }: ReviewFormProps) => {
  const { createReview } = useReviews(bookId);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      title: "",
      content: "",
      is_spoiler: false,
      is_public: true,
    },
  });

  const onSubmit = async (data: ReviewFormData) => {
    setSubmitting(true);
    const result = await createReview({
      book_id: bookId,
      rating: data.rating,
      title: data.title ? sanitizeInput(data.title) : undefined,
      content: sanitizeInput(data.content),
      is_spoiler: data.is_spoiler,
      is_public: data.is_public,
    });

    if (result.success) {
      form.reset();
      onOpenChange(false);
    }
    setSubmitting(false);
  };

  const rating = form.watch("rating");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>
            Share your thoughts about this book with the community
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating *</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const starValue = i + 1;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => field.onChange(starValue)}
                            onMouseEnter={() => setHoveredRating(starValue)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`h-8 w-8 transition-colors ${
                                starValue <= (hoveredRating || rating)
                                  ? "fill-primary text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Review Title (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Sum up your review in one line"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Review *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did you think about this book?"
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Minimum 10 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_spoiler"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Contains Spoilers</FormLabel>
                    <FormDescription>
                      Mark this if your review reveals plot details
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_public"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Public Review</FormLabel>
                    <FormDescription>
                      Allow others to see your review
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
