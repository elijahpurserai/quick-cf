import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { useApp } from "../contexts/AppContext";
import { slugifyTag } from "../utils/tags";
import { useLanguage } from "../contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Star,
  Clock,
  Calendar,
  Heart,
  Edit,
  RefreshCw,
  Plus,
  ArrowLeft,
  Sparkles,
  Printer,
  Share2,
  Play,
  Volume2,
  Download,
} from "lucide-react";
import { api } from "../services/api";
import { trackEvent } from "../utils/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { updateMetaTags, resetMetaTags } from "../utils/seo";
import { cn } from "../components/ui/utils";
import { toast } from "sonner";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { VisibilityBadge } from "../components/VisibilityBadge";
import { Visibility } from "../types";
import ReactMarkdown from "react-markdown";
import { useRef } from "react";
import { exportToPDF } from "../utils/pdfExport";

export function StoryPage() {
  const { identifier } = useParams();
  const { stories, user, favorites, toggleFavorite, rateStory, updateStory } =
    useApp();
  const { localizedPath, t, lang } = useLanguage();
  const [userRating, setUserRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [regenerateData, setRegenerateData] = useState({
    childName: "",
    age: "",
    changes: "",
  });
  const [isGeneratingChapter, setIsGeneratingChapter] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const imageRequestStarted = useRef<string | null>(null);

  // Persistence logic
  const [fetchedStory, setFetchedStory] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);

  const localStory = stories.find((s) => s.id === identifier || s.slug === identifier);
  const story = fetchedStory || localStory;

  useEffect(() => {
    const fetchStory = async () => {
      if (!localStory && identifier) {
        setIsFetching(true);
        try {
          const data = await api.stories.getStoryBySlug(identifier);
          setFetchedStory(data);
        } catch (error) {
          console.error("Failed to fetch story:", error);
        } finally {
          setIsFetching(false);
        }
      }
    };
    fetchStory();
  }, [identifier]);

  // Update meta tags when story changes
  useEffect(() => {
    if (story) {
      updateMetaTags(story, undefined, undefined, "story");
    }
    return () => {
      resetMetaTags();
      // Cleanup audio URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [story]);

  // Trigger image generation if missing
  useEffect(() => {
    if (story && !story.imageUrl && imageRequestStarted.current !== story.id) {
      imageRequestStarted.current = story.id;
      api.stories.generateImage(story.title, story.description, story.id, story.imagePrompt)
        .then(imageUrl => {
          updateStory(story.id, { imageUrl });
        })
        .catch(err => {
          console.error("Failed to generate story image:", err);
          imageRequestStarted.current = null; // Allow retry if it failed
        });
    }
  }, [identifier, story?.id, story?.imageUrl]);

  if (isFetching) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="animate-spin size-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-xl text-gray-600">{t("story.loading")}</p>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-xl text-gray-600">{t("story.notFound")}</p>
        <Link to={localizedPath("/")}>
          <Button className="mt-4">{t("common.goHome")}</Button>
        </Link>
      </div>
    );
  }

  const isFavorite = favorites.includes(story.id);
  const isOwner = user && story.ownerId === user.id;

  const handleRateStory = (rating: number) => {
    if (!user) {
      toast.error(t("toast.signInToRate"));
      return;
    }
    if (userRating > 0) {
      return; // Already rated this session
    }
    setUserRating(rating);
    rateStory(story.id, rating);
    toast.success(t("toast.rated", { rating }));
  };

  const handleReplaceHeroName = () => {
    const newName = prompt("Enter the new hero name:", story.childName);
    if (newName && newName.trim()) {
      const updatedContent = story.content.replace(
        new RegExp(story.childName, "g"),
        newName.trim()
      );
      updateStory(story.id, {
        content: updatedContent,
        childName: newName.trim(),
        title: story.title.replace(story.childName, newName.trim()),
      });
      toast.success(t("toast.heroNameUpdated"));
    }
  };

  const handleRegenerateStory = () => {
    // Simulate regeneration
    const newStoryId = `${story.id}-v${Date.now()}`;
    const newContent = `${story.content}\n\n[This story has been regenerated with the following changes: ${regenerateData.changes}]`;

    updateStory(story.id, {
      id: newStoryId,
      content: newContent,
      childName: regenerateData.childName || story.childName,
      age: regenerateData.age ? parseInt(regenerateData.age) : story.age,
    });

    setIsRegenerateOpen(false);
    setRegenerateData({ childName: "", age: "", changes: "" });
    toast.success(t("toast.storyRegenerated"));
  };

  const handlePrint = () => {
    trackEvent("print_content", { type: "story", id: story.id });
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    toast.info(t("toast.preparingPDF"));
    try {
      const date = story.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const fullContent = story.chapters.length > 0
        ? story.content + "\n\n" + story.chapters.map((c: any) => c.content).join("\n\n")
        : story.content;
      await exportToPDF({
        title: story.title,
        content: fullContent,
        imageUrl: story.imageUrl,
        metadata: [`${story.duration} min read`, date, story.purpose],
        accentColor: "#9333ea",
        gradientEnd: "#ec4899",
        filename: story.title,
        dir: story.language === "he" ? "rtl" : "ltr",
      });
      trackEvent("download_pdf", { type: "story", id: story.id });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error(t("toast.pdfFailed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: story.title,
      text: `Check out this amazing story: ${story.title}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        `${shareData.text} ${shareData.url}`
      )}`;
      window.open(whatsappUrl, "_blank");
    }

    trackEvent("share_content", {
      type: "story",
      id: story.id,
      platform: typeof navigator.share !== "undefined" ? "native" : "whatsapp"
    });
  };

  const handleGenerateNextChapter = async () => {
    if (!isOwner) return;

    setIsGeneratingChapter(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const chapterNumber = story.chapters.length + 2;
    const newChapter = {
      id: `chapter-${Date.now()}`,
      content: `Chapter ${chapterNumber}: The Adventure Continues\n\n${story.childName} woke up the next morning, still thinking about yesterday's amazing adventure. But little did ${story.childName} know, an even more exciting journey was about to begin!\n\nAs ${story.childName} walked outside, something magical caught their eye...`,
      createdAt: new Date(),
    };

    updateStory(story.id, {
      chapters: [...story.chapters, newChapter],
    });

    setIsGeneratingChapter(false);
    toast.success(t("toast.nextChapterGenerated"));
  };

  const handleListen = async () => {
    if (audioUrl) {
      // If we already have audio, just play it
      const audio = new Audio(audioUrl);
      audio.play();
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const blob = await api.stories.generateAudio(story.content);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      toast.success(t("toast.startingNarration"));

      trackEvent("narrate_story", {
        id: story.id,
        voice: "shimmer"
      });
    } catch (err) {
      console.error("Failed to generate audio:", err);
      toast.error(t("toast.narratorTired"));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Top Bar: Back Button + Actions */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link to={localizedPath("/")}>
          <Button variant="ghost">
            <ArrowLeft className="size-4 mr-2" />
            {t("common.backToHome")}
          </Button>
        </Link>

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="text-gray-400 hover:text-purple-600"
            title="Download as PDF"
          >
            <Download className={`size-5 ${isGeneratingPDF ? "animate-bounce" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="text-gray-400 hover:text-purple-600"
            title={t("story.print")}
          >
            <Printer className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="text-gray-400 hover:text-blue-600"
            title={t("story.share")}
          >
            <Share2 className="size-5" />
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFavorite(story.id)}
              className={isFavorite ? "text-red-500" : "text-gray-400"}
              title={isFavorite ? t("story.removeFavorite") : t("story.addFavorite")}
            >
              <Heart
                className={`size-6 ${isFavorite ? "fill-current" : ""}`}
              />
            </Button>
          )}
        </div>
      </div>

      {/* Story Header */}
      <Card className="mb-8 overflow-hidden relative">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5 hidden lg:block">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1512331455279-c8ae8178f586?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYWlyeSUyMHRhbGUlMjBib29rJTIwbWFnaWN8ZW58MXx8fHwxNzcxMzQ0NjM1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt=""
            className="w-full h-full object-cover rounded-lg"
          />
        </div>

        {/* Gradient top border */}
        <div className="h-1 w-full bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400" />

        <CardHeader className="relative z-10">
          <div>
            <div>
              {/* Illustration Area */}
              <div className="mb-6 rounded-2xl overflow-hidden aspect-video relative group bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-100 flex items-center justify-center">
                {story.imageUrl ? (
                  <img
                    src={story.imageUrl}
                    alt={story.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <Sparkles className="size-12 text-purple-300 animate-pulse" />
                      <div className="absolute inset-0 bg-purple-400 blur-xl opacity-20 animate-ping" />
                    </div>
                    <p className="text-sm font-medium text-purple-400/80 animate-pulse">
                      {t("story.paintingIllustration")}
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <CardTitle className="text-3xl">{story.title}</CardTitle>

                <div className="flex items-center gap-4">
                  {audioUrl ? (
                    <div className="bg-purple-50 p-2 rounded-xl border border-purple-100 flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="bg-purple-600 p-2 rounded-full text-white shadow-sm">
                        <Volume2 className="size-4" />
                      </div>
                      <audio
                        src={audioUrl}
                        controls
                        className="h-8 max-w-[200px] sm:max-w-[300px]"
                        autoPlay
                      />
                    </div>
                  ) : (
                    <Button
                      onClick={handleListen}
                      disabled={isGeneratingAudio}
                      variant="outline"
                      className={cn(
                        "rounded-full px-6 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all",
                        isGeneratingAudio && "animate-pulse border-purple-400 bg-purple-50"
                      )}
                    >
                      {isGeneratingAudio ? (
                        <>
                          <Volume2 className="size-4 mr-2 animate-bounce" />
                          {t("story.warmingUp")}
                        </>
                      ) : (
                        <>
                          <Play className="size-4 mr-2" />
                          {t("story.narrate")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
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
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {story.createdAt.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Badge>
                <VisibilityBadge
                  visibility={story.visibility || "public"}
                  isOwner={!!isOwner}
                  creationId={story.id}
                  onVisibilityChange={(v: Visibility) => {
                    updateStory(story.id, { visibility: v });
                    setFetchedStory((prev: any) => prev ? { ...prev, visibility: v } : prev);
                  }}
                />
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {story.tags.map((tag: any, index: number) => {
                  const tagName = typeof tag === 'string' ? tag : tag.name;
                  const tagSlug = typeof tag === 'string' ? slugifyTag(tag) : tag.slug;
                  return (
                    <Link key={tagSlug || `tag-${index}`} to={localizedPath(`/cat/${tagSlug}`)}>
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-purple-100 transition-colors"
                      >
                        #{tagName}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Rating Display */}
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg print:hidden">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center"
                onMouseLeave={() => user && !userRating && setHoveredRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const canRate = !!user && userRating === 0;
                  const filled = userRating > 0
                    ? star <= userRating
                    : user
                      ? star <= (hoveredRating || Math.round(story.rating))
                      : star <= Math.round(story.rating);
                  return (
                    <button
                      key={star}
                      onClick={() => canRate && handleRateStory(star)}
                      onMouseEnter={() => canRate && setHoveredRating(star)}
                      disabled={!canRate}
                      className={`p-0.5 ${canRate ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <Star
                        className={`size-6 transition-colors ${filled
                          ? "fill-yellow-400 text-yellow-400"
                          : user
                            ? "text-gray-300 hover:text-yellow-200"
                            : "text-gray-300"
                          }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-lg font-medium">
                {story.rating > 0 ? story.rating.toFixed(1) : t("story.noRatings")}
              </span>
              <span className="text-sm text-gray-500">
                {t("story.ratingsCount").replace("{count}", String(story.ratingsCount))}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-6 print:hidden">
            <Button variant="outline" onClick={handleReplaceHeroName}>
              <Edit className="size-4 mr-2" />
              {t("story.replaceHeroName")}
            </Button>

            <Dialog open={isRegenerateOpen} onOpenChange={setIsRegenerateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <RefreshCw className="size-4 mr-2" />
                  {t("story.regenerate")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("story.regenerate")}</DialogTitle>
                  <DialogDescription>
                    {t("story.regenerateDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newChildName">{t("story.childNameLabel")}</Label>
                    <Input
                      id="newChildName"
                      placeholder={story.childName}
                      value={regenerateData.childName}
                      onChange={(e) =>
                        setRegenerateData({
                          ...regenerateData,
                          childName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="newAge">{t("story.ageLabel")}</Label>
                    <Input
                      id="newAge"
                      type="number"
                      placeholder={story.age.toString()}
                      value={regenerateData.age}
                      onChange={(e) =>
                        setRegenerateData({
                          ...regenerateData,
                          age: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="changes">{t("story.changesToStory")}</Label>
                    <Textarea
                      id="changes"
                      placeholder={t("story.changePlaceholder")}
                      value={regenerateData.changes}
                      onChange={(e) =>
                        setRegenerateData({
                          ...regenerateData,
                          changes: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Button onClick={handleRegenerateStory} className="w-full">
                    <RefreshCw className="size-4 mr-2" />
                    {t("story.regenerateBtn")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Generate Next Chapter - hidden for now
            {isOwner && (
              <Button
                variant="outline"
                onClick={handleGenerateNextChapter}
                disabled={isGeneratingChapter}
              >
                <Plus className="size-4 mr-2" />
                {isGeneratingChapter ? "Generating..." : "Generate Next Chapter"}
              </Button>
            )}
            */}
          </div>

          <Separator className="my-6" />

          {/* Story Content */}
          <div className={cn("max-w-none", story.language === "he" && "text-right")} dir={story.language === "he" ? "rtl" : "ltr"}>
            <div className="text-lg leading-relaxed story-markdown">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => (
                    <h3
                      className="text-3xl font-bold mt-12 mb-8 text-purple-800 font-serif italic border-b-2 border-purple-100 pb-2 flex items-center gap-3"
                      {...props}
                    >
                      <Sparkles className="size-6 text-purple-400 shrink-0" />
                      {props.children}
                    </h3>
                  ),
                  h2: ({ node, ...props }) => (
                    <h3
                      className="text-2xl font-bold mt-10 mb-6 text-purple-700 font-serif italic border-b-2 border-purple-100 pb-2 flex items-center gap-2"
                      {...props}
                    >
                      <Sparkles className="size-5 text-purple-400 shrink-0" />
                      {props.children}
                    </h3>
                  ),
                  h3: ({ node, ...props }) => (
                    <h3
                      className="text-2xl font-bold mt-10 mb-6 text-purple-700 font-serif italic border-b-2 border-purple-100 pb-2 flex items-center gap-2"
                      {...props}
                    >
                      <Sparkles className="size-5 text-purple-400 shrink-0" />
                      {props.children}
                    </h3>
                  ),
                  p: ({ node, ...props }) => (
                    <p className="mb-6 last:mb-0" {...props} />
                  ),
                }}
              >
                {story.content}
              </ReactMarkdown>
            </div>

            {/* Chapters */}
            {story.chapters.map((chapter) => (
              <div key={chapter.id} className="mt-12 pt-12 border-t-2 border-dashed border-gray-100 italic font-medium text-gray-700">
                <div className="story-markdown">
                  <ReactMarkdown
                    components={{
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xl font-bold mt-6 mb-4 text-blue-700 flex items-center gap-2" {...props}>
                          <Plus className="size-4 text-blue-400" />
                          {props.children}
                        </h3>
                      )
                    }}
                  >
                    {chapter.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Story Metadata (for SEO) */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("story.details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>{t("story.character")}</strong> {story.childName}, {t("story.ageDetail").replace("{age}", String(story.age))}
          </p>
          {story.siblings && story.siblings.length > 0 && (
            <p>
              <strong>{t("story.siblings")}</strong> {story.siblings.map(s => s.name).join(", ")}
            </p>
          )}
          {story.pets && story.pets.length > 0 && (
            <p>
              <strong>{t("story.pets")}</strong> {story.pets.map((p: any) => `${p.name} (${p.type})`).join(", ")}
            </p>
          )}
          {story.parentNames && story.parentNames.length > 0 && (
            <p>
              <strong>{t("story.parents")}</strong> {story.parentNames.map(p => p.name).join(", ")}
            </p>
          )}
          <p>
            <strong>{t("story.created")}</strong> {story.createdAt.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}