"use client";

import { useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitFeedback } from "@/app/dashboard/actions";

export interface RecommendationCardProps {
  id: string;
  title: string;
  url: string;
  rationale: string;
  category: string;
  repoFullName: string;
  isNew: boolean;
  feedback: "up" | "down" | null;
}

export function RecommendationCard({
  id,
  title,
  url,
  rationale,
  category,
  repoFullName,
  isNew,
  feedback,
}: RecommendationCardProps) {
  const [isPending, startTransition] = useTransition();

  function vote(next: "up" | "down") {
    startTransition(() => submitFeedback(id, next));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {title}
            </a>
          </CardTitle>
          {isNew && <Badge variant="secondary">New</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{rationale}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {category && <Badge variant="outline">{category}</Badge>}
            <span>from {repoFullName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant={feedback === "up" ? "default" : "ghost"}
              disabled={isPending}
              onClick={() => vote("up")}
              aria-label="Relevant"
            >
              <ThumbsUp className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={feedback === "down" ? "default" : "ghost"}
              disabled={isPending}
              onClick={() => vote("down")}
              aria-label="Not relevant"
            >
              <ThumbsDown className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
