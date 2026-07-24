import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Star, Clock, Heart, Sparkles, Trash2, Loader2 } from "lucide-react";
import { Story } from "../types";
import { Button } from "./ui/button";
import { useApp } from "../contexts/AppContext";
import { toast } from "sonner";
import { slugifyTag } from "../utils/tags";
import { cn } from "./ui/utils";
import { useLanguage } from "../contexts/LanguageContext";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface StoryCardProps {
  story: Story;
  onDeleted?: (id: string) => void;
  hideImage?: boolean;
}

export function StoryCard({ story, onDeleted, hideImage }: StoryCardProps) {
  const { favorites, toggleFavorite, user } = useApp();
  const { localizedPath, t } = useLanguage();
  const isFavorite = favorites.includes(story.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t("toast.signInToFavorite"));
      return;
    }
    toggleFavorite(story.id);
    if (isFavorite) {
      toast.success(t("toast.removedFromFavorites"));
    } else {
      toast.success(t("toast.addedToFavorites"));
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/admin/creations/${story.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("toast.storyDeleted"));
      setDeleted(true);
      onDeleted?.(story.id);
    } catch {
      toast.error(t("toast.storyDeleteFailed"));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (deleted) return null;

  return (
    <Card className="hover:shadow-lg transition-shadow border-purple-100 overflow-hidden group/card relative">
      {/* Decorative corner sparkle */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
        <Sparkles className="size-4 text-purple-400" />
      </div>

      {/* Colorful gradient top border */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400" />

      {story.imageUrl && !hideImage && (
        <Link to={localizedPath(`/story/${story.slug || story.id}`)}>
          <div className="aspect-video w-full overflow-hidden cursor-pointer relative">
            <img
              src={story.imageUrl}
              alt={story.title}
              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
            />
            {/* Admin delete button — visible on hover */}
            {user?.isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  "absolute top-2 left-2 z-20 rounded-full p-2 shadow-lg transition-all",
                  "opacity-0 group-hover/card:opacity-100",
                  confirmDelete
                    ? "bg-red-600 text-white scale-110"
                    : "bg-white/90 text-red-500 hover:bg-red-600 hover:text-white",
                  deleting && "opacity-100 cursor-wait"
                )}
                title={confirmDelete ? "Click again to confirm" : "Delete story"}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            )}
          </div>
        </Link>
      )}

      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <Link to={`/story/${story.slug || story.id}`}>
              <CardTitle className="hover:text-purple-600 transition-colors">
                {story.title}
              </CardTitle>
            </Link>
          </div>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFavorite}
              className={isFavorite ? "text-red-500" : "text-gray-400"}
            >
              <Heart
                className={`size-5 ${isFavorite ? "fill-current" : ""}`}
              />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <Badge
            variant="secondary"
            className={
              story.purpose === "adventure"
                ? "bg-blue-100 text-blue-700"
                : story.purpose === "education"
                  ? "bg-green-100 text-green-700"
                  : "bg-purple-100 text-purple-700"
            }
          >
            {story.purpose}
          </Badge>
          {story.educationCategory && (
            <Badge variant="outline">{story.educationCategory}</Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="size-3" />
            {t("common.durationMin").replace("{duration}", String(story.duration))}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {story.description}
        </p>

        <div className="flex items-center justify-between text-sm">
          <div className={cn("flex items-center gap-2", story.rating === 0 && "invisible")}>
            <div className="flex items-center gap-1">
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{story.rating.toFixed(1)}</span>
            </div>
            <span className="text-gray-500">{t("story.ratingsCount").replace("{count}", String(story.ratingsCount))}</span>
          </div>

          <div className="text-gray-500">
            {t("story.ageDetail").replace("{age}", String(story.age))}
          </div>
        </div>

        {story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {story.tags
              .map((tag) => ({
                tagName: typeof tag === 'string' ? tag : tag.name,
                tagSlug: typeof tag === 'string' ? slugifyTag(tag) : (tag.slug || slugifyTag(tag)),
              }))
              .filter(({ tagSlug }) => tagSlug && tagSlug.trim().length > 0)
              .slice(0, 4)
              .map(({ tagName, tagSlug }) => (
                <Link key={tagSlug} to={localizedPath(`/cat/${tagSlug}`)}>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 h-5 bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
                  >
                    #{tagName}
                  </Badge>
                </Link>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}