import { useRef } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDirectImageUpload } from '@/hooks/use-direct-image-upload';
import { useGenerateImage } from '@/hooks/use-generate-image';
import { useToast } from '@/hooks/use-toast';
import type { BeerLiquorDraft } from '@/types/ingestion';

// =============================================================================
// Types
// =============================================================================

interface BeerLiquorEditorProps {
  draft: BeerLiquorDraft;
  onChange: (updated: BeerLiquorDraft) => void;
}

// =============================================================================
// Component
// =============================================================================

/** Maps beer/liquor category + subcategory to a surface variant for DALL-E prompting. */
function deriveBeerLiquorCategory(category: string, subcategory: string): string {
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();
  if (cat === 'beer') {
    if (/stout|porter/.test(sub)) return 'dark-beer';
    if (/ipa|pale ale/.test(sub)) return 'ipa-craft';
    return 'light-beer';
  }
  // Liquor
  if (/bourbon|whiskey|whisky|scotch|rye|irish/.test(sub)) return 'whiskey';
  if (/vodka|gin/.test(sub)) return 'vodka-gin';
  if (/rum/.test(sub)) return 'rum';
  if (/tequila|mezcal/.test(sub)) return 'tequila';
  return 'spirit';
}

export function BeerLiquorEditor({ draft, onChange }: BeerLiquorEditorProps) {
  const { uploadToStorage, isUploading } = useDirectImageUpload();
  const { generateImage, isGenerating } = useGenerateImage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof BeerLiquorDraft>(key: K, value: BeerLiquorDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  async function handleImageUpload(file: File) {
    const url = await uploadToStorage(file);
    if (url) {
      set('image', url);
    } else {
      toast({ title: 'Upload failed', description: 'Could not upload image', variant: 'destructive' });
    }
  }

  async function handleGenerateImage() {
    if (!draft.name) {
      toast({ title: 'Name required', description: 'Enter a name before generating an image' });
      return;
    }
    const result = await generateImage({
      productTable: 'beer_liquor_list',
      name: draft.name,
      prepType: draft.subcategory || draft.category,
      description: draft.description,
      category: deriveBeerLiquorCategory(draft.category || '', draft.subcategory || ''),
    });
    if (result?.imageUrl) set('image', result.imageUrl);
  }

  return (
    <Accordion type="multiple" defaultValue={['info', 'details', 'image']}>
      {/* Info */}
      <AccordionItem value="info">
        <AccordionTrigger className="text-base font-semibold tracking-tight">Info</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="bl-name">Name</Label>
              <Input
                id="bl-name"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g., Corona Extra"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bl-category">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => set('category', v as BeerLiquorDraft['category'])}
                >
                  <SelectTrigger id="bl-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beer">Beer</SelectItem>
                    <SelectItem value="Liquor">Liquor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bl-subcategory">Subcategory</Label>
                <Input
                  id="bl-subcategory"
                  value={draft.subcategory}
                  onChange={(e) => set('subcategory', e.target.value)}
                  placeholder="e.g., Lager, Vodka, Bourbon"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bl-producer">Producer</Label>
                <Input
                  id="bl-producer"
                  value={draft.producer}
                  onChange={(e) => set('producer', e.target.value)}
                  placeholder="e.g., Anheuser-Busch"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bl-country">Country</Label>
                <Input
                  id="bl-country"
                  value={draft.country}
                  onChange={(e) => set('country', e.target.value)}
                  placeholder="e.g., Mexico"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-style">Style</Label>
              <Input
                id="bl-style"
                value={draft.style}
                onChange={(e) => set('style', e.target.value)}
                placeholder="e.g., Pale Lager, Single Malt, Blanco"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Details */}
      <AccordionItem value="details">
        <AccordionTrigger className="text-base font-semibold tracking-tight">Details</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="bl-description">Description</Label>
              <Textarea
                id="bl-description"
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Brief tasting notes or product description..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-notes">Notes</Label>
              <Textarea
                id="bl-notes"
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Service notes, pairing suggestions..."
                rows={3}
              />
            </div>
            <div className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors',
              draft.isFeatured
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                : 'bg-muted/30'
            )}>
              <span className="text-sm font-medium">Featured</span>
              <Switch
                checked={draft.isFeatured}
                onCheckedChange={(checked) => set('isFeatured', checked)}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Image */}
      <AccordionItem value="image">
        <AccordionTrigger className="text-base font-semibold tracking-tight">
          Image
          {draft.image && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">(1 photo)</span>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pt-2">
            {draft.image && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <img src={draft.image} alt={draft.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => set('image', null)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Upload className="h-4 w-4 mr-2" />}
                Upload
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isGenerating || !draft.name}
                onClick={handleGenerateImage}
              >
                {isGenerating
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Sparkles className="h-4 w-4 mr-2" />}
                Generate AI
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = '';
              }}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
