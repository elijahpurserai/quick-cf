import { Link } from "react-router";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Clock, Star, BookOpen, Calendar } from "lucide-react";
import { Lesson } from "../types";
import { slugifyTag } from "../utils/tags";
import { cn } from "./ui/utils";
import { useLanguage } from "../contexts/LanguageContext";

interface LessonCardProps {
    lesson: Lesson;
    hideImage?: boolean;
}

export function LessonCard({ lesson, hideImage }: LessonCardProps) {
    const { localizedPath, t } = useLanguage();
    return (
        <Card className="h-full flex flex-col hover:shadow-lg transition-shadow duration-300 border-blue-100 overflow-hidden group">
            <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-green-400 to-teal-400" />

            {lesson.imageUrl && !hideImage && (
                <Link to={localizedPath(`/lesson/${lesson.slug || lesson.id}`)}>
                    <div className="aspect-video w-full overflow-hidden cursor-pointer">
                        <img
                            src={lesson.imageUrl}
                            alt={lesson.topic}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    </div>
                </Link>
            )}

            <CardHeader className="pb-2 relative overflow-hidden">
                {/* Decorative background for lesson card */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-teal-50 opacity-50 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start z-10">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                        {lesson.level}
                    </Badge>
                    <div className={cn(
                        "flex items-center text-yellow-500 text-xs font-medium bg-white/80 px-2 py-1 rounded-full shadow-sm",
                        lesson.rating === 0 && "invisible"
                    )}>
                        <Star className="size-3 mr-1 fill-yellow-500" />
                        {lesson.rating.toFixed(1)}
                    </div>
                </div>
                <CardTitle className="text-xl font-bold line-clamp-2 mt-2 z-10 text-blue-900 group-hover:text-blue-700 transition-colors">
                    <Link to={`/lesson/${lesson.slug || lesson.id}`} className="hover:underline">
                        {lesson.topic}
                    </Link>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-grow pt-2 z-10">
                <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                    {(lesson.description || lesson.content || "").substring(0, 100).replace(/[#*]/g, "")}...
                </p>

                <div className="flex flex-wrap gap-2 mt-auto">
                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">
                        {lesson.tone}
                    </Badge>
                    {lesson.tags
                        ?.map((tag) => ({
                            tagName: typeof tag === 'string' ? tag : tag.name,
                            tagSlug: typeof tag === 'string' ? slugifyTag(tag) : (tag.slug || slugifyTag(tag)),
                        }))
                        .filter(({ tagSlug }) => tagSlug && tagSlug.trim().length > 0)
                        .slice(0, 3)
                        .map(({ tagName, tagSlug }) => (
                            <Link key={tagSlug} to={localizedPath(`/cat/${tagSlug}`)}>
                                <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 h-5 bg-green-50 text-green-700 border-green-100 hover:bg-green-100 transition-colors cursor-pointer"
                                >
                                    #{tagName}
                                </Badge>
                            </Link>
                        ))}
                </div>
            </CardContent>

            <CardFooter className="pt-2 pb-4 text-xs text-gray-400 flex justify-between items-center border-t border-blue-50 bg-white/50 z-10">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {lesson.duration}m
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(lesson.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <Link to={localizedPath(`/lesson/${lesson.slug || lesson.id}`)}>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                        {t("lessonCard.startLearning")} <BookOpen className="size-3 ml-1" />
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
}
