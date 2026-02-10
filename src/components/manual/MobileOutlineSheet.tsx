/**
 * MobileOutlineSheet
 *
 * Bottom sheet for mobile navigation.
 * Contains ManualOutline.
 */

import { X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { ManualOutline, type ManualSection } from "@/components/ui/manual-outline";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

export function MobileOutlineSheet({
  open,
  onOpenChange,
  sections,
  activeId,
  onSelect,
  defaultExpanded = [],
}: MobileOutlineSheetProps) {
  const handleSelect = (sectionId: string) => {
    onSelect(sectionId);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex flex-row items-center justify-between border-b pb-4">
          <DrawerTitle className="text-section-title">Contents</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 pb-8 mt-4">
          <ManualOutline
            sections={sections}
            activeId={activeId}
            onSelect={handleSelect}
            defaultExpanded={defaultExpanded}
          />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
