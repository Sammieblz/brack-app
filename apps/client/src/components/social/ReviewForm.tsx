import { useId, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { toPlainRichTextPayload } from "@/lib/richText";
import { useReviews } from "@/hooks/useReviews";
import { Star } from "iconoir-react";
import { sanitizeInput } from "@/utils/sanitize";
import type { RichTextPayload } from "@/types/richText";

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
  const id = useId();
  const { createReview } = useReviews(bookId);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [richText, setRichText] = useState<RichTextPayload>(() => toPlainRichTextPayload(""));

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
    setSubmitError(null);
    try {
      const result = await createReview({
      book_id: bookId,
      rating: data.rating,
      title: data.title ? sanitizeInput(data.title) : undefined,
      content: sanitizeInput(data.content),
      content_format: richText.content_format,
      content_json: richText.content_json,
      content_html: richText.content_html,
      is_spoiler: data.is_spoiler,
      is_public: data.is_public,
    });

      if (result.success) {
        form.reset();
        setRichText(toPlainRichTextPayload(""));
        onOpenChange(false);
      } else {
        setSubmitError(result.error || "Failed to create review");
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create review");
    } finally {
      setSubmitting(false);
    }
  };

  const rating = form.watch("rating");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-display">Write a Review</DialogTitle>
          <DialogDescription className="font-sans">
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
                  <FormLabel id={`${id}-rating-label`} className="font-sans">Rating *</FormLabel>
                  <FormControl>
                    <div role="radiogroup" aria-labelledby={`${id}-rating-label`} aria-required="true" className="flex gap-2">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const starValue = i + 1;
                        return (
                          <label
                            key={i}
                            onMouseEnter={() => setHoveredRating(starValue)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="relative cursor-pointer rounded focus-within:outline focus-within:outline-2 focus-within:outline-ring"
                          >
                            <input type="radio" name={`${id}-rating`} value={starValue}
                              checked={rating === starValue} onChange={() => field.onChange(starValue)}
                              onBlur={field.onBlur} ref={starValue === 1 ? field.ref : undefined}
                              aria-label={`${starValue} ${starValue === 1 ? "star" : "stars"}`} className="sr-only" />
                            <Star
                              aria-hidden="true"
                              className={`h-8 w-8 transition-colors ${
                                starValue <= (hoveredRating || rating)
                                  ? "fill-primary text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormDescription className="sr-only">Choose a rating from 1 to 5 stars.</FormDescription>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-sans">Review Title (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Sum up your review in one line"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="sr-only">Optional review title, up to 200 characters.</FormDescription>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id={`${id}-review-label`} className="font-sans">Review *</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      ref={field.ref}
                      onBlur={field.onBlur}
                      labelledBy={`${id}-review-label`}
                      aria-required="true"
                      placeholder="What did you think about this book?"
                      value={richText}
                      limit={5000}
                      minHeightClassName="min-h-36"
                      onChange={(payload) => {
                        setRichText(payload);
                        field.onChange(payload.content);
                      }}
                    />
                  </FormControl>
                  <FormDescription className="font-sans">Minimum 10 characters</FormDescription>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_spoiler"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="font-sans text-base">Contains Spoilers</FormLabel>
                    <FormDescription className="font-sans">
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
                    <FormLabel className="font-sans text-base">Public Review</FormLabel>
                    <FormDescription className="font-sans">
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

            {submitError && <p id={`${id}-submit-error`} role="alert" className="text-sm text-destructive">{submitError}</p>}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} aria-describedby={submitError ? `${id}-submit-error` : undefined}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
