/**
 * MobileOutlineSheet
 * 
 * Bottom sheet for mobile navigation.
 * Contains ManualOutline and Bookmarks tab.
 */

import { useState } from "react";
import { BookOpen, Bookmark, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { ManualOutline, type ManualSection } from "@/components/ui/manual-outline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface BookmarkItem {
  id: string;
  title: string;
}

export interface MobileOutlineSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onOpenChange: (open: boolean) => void;
  /** Manual sections for the outline */
  sections: ManualSection[];
  /** Currently active section ID */
  activeId?: string;
  /** Called when a section is selected */
  onSelect: (sectionId: string) => void;
  /** Default expanded section IDs */
  defaultExpanded?: string[];
  /** Bookmarked sections */
  bookmarks: BookmarkItem[];
  /** Localized labels */
  labels?: {
    contents?: string;
    bookmarks?: string;
    noBookmarks?: string;
  };
}

export function MobileOutlineSheet({
  open,
  onOpenChange,
  sections,
  activeId,
  onSelect,
  defaultExpanded = [],
  bookmarks,
  labels = {},
}: MobileOutlineSheetProps) {
  const {
    contents = "Contents",
    bookmarks: bookmarksLabel = "Bookmarks",
    noBookmarks = "No bookmarks yet",
  } = labels;

  const handleSelect = (sectionId: string) => {
    onSelect(sectionId);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex flex-row items-center justify-between border-b pb-4">
          <DrawerTitle className="text-section-title">Navigation</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="contents" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2">
              <TabsTrigger value="contents" className="gap-2">
                <BookOpen className="h-4 w-4" />
                {contents}
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="gap-2">
                <Bookmark className="h-4 w-4" />
                {bookmarksLabel}
                {bookmarks.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {bookmarks.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent 
              value="contents" 
              className="flex-1 overflow-y-auto px-4 pb-8 mt-4"
            >
              <ManualOutline
                sections={sections}
                activeId={activeId}
                onSelect={handleSelect}
                defaultExpanded={defaultExpanded}
              />
            </TabsContent>

            <TabsContent 
              value="bookmarks" 
              className="flex-1 overflow-y-auto px-4 pb-8 mt-4"
            >
              {bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">{noBookmarks}</p>
                </div>
              ) : (
                <ul className="space-y-xs">
                  {bookmarks.map((bookmark) => (
                    <li key={bookmark.id}>
                      <button
                        onClick={() => handleSelect(bookmark.id)}
                        className={cn(
                          "flex items-center gap-sm w-full min-h-[44px] px-sm py-xs rounded-lg",
                          "text-body text-left transition-colors duration-micro",
                          "hover:bg-accent/50",
                          activeId === bookmark.id && "bg-accent text-primary font-medium"
                        )}
                      >
                        <Bookmark className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{bookmark.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
