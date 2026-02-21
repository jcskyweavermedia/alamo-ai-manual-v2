import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useIngestionSession } from '@/hooks/use-ingestion-session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChefHat,
  Package,
  UtensilsCrossed,
  Wine,
  GlassWater,
  Beer,
  Loader2,
} from 'lucide-react';
import type { ProductType } from '@/types/ingestion';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Map ProductType to the Supabase table name */
const PRODUCT_TABLE_MAP: Record<ProductType, string> = {
  prep_recipe: 'prep_recipes',
  plate_spec: 'plate_specs',
  foh_plate_spec: 'foh_plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
  beer_liquor: 'beer_liquor_list',
};

interface ProductTypeCard {
  key: ProductType;
  label: string;
  icon: LucideIcon;
  emoji: string;
  enabled: boolean;
}

const PRODUCT_TYPE_CARDS: ProductTypeCard[] = [
  { key: 'prep_recipe', label: 'Prep Recipe', icon: ChefHat, emoji: '👨‍🍳', enabled: true },
  { key: 'plate_spec', label: 'Plate Spec', icon: Package, emoji: '📦', enabled: false },
  { key: 'foh_plate_spec', label: 'Dish Guide', icon: UtensilsCrossed, emoji: '🍽️', enabled: false },
  { key: 'wine', label: 'Wine', icon: Wine, emoji: '🍷', enabled: true },
  { key: 'cocktail', label: 'Cocktail', icon: GlassWater, emoji: '🍸', enabled: true },
  { key: 'beer_liquor', label: 'Beer/Liquor', icon: Beer, emoji: '🍺', enabled: false },
];

// =============================================================================
// COMPONENT
// =============================================================================

function IngestWizard() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { isAdmin } = useAuth();
  const { createSession } = useIngestionSession();

  // Wizard state
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCancel = () => {
    navigate('/admin/ingest');
  };

  const handleCreateSession = async () => {
    if (!selectedType) return;

    setIsCreating(true);
    try {
      const tableName = PRODUCT_TABLE_MAP[selectedType];
      const sessionId = await createSession(tableName);
      if (sessionId) {
        navigate(`/admin/ingest/${sessionId}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      isAdmin={isAdmin}
      showSearch={false}
      constrainContentWidth={true}
    >
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">
              What are you creating?
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a product type to get started
            </p>
          </div>

          {/* Product type grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PRODUCT_TYPE_CARDS.map((card) => {
              const Icon = card.icon;
              const isSelected = selectedType === card.key;
              const isDisabled = !card.enabled;

              return (
                <button
                  key={card.key}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedType(card.key)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isDisabled && 'opacity-50 cursor-not-allowed',
                    !isDisabled && 'cursor-pointer hover:bg-accent/50',
                    isSelected && !isDisabled
                      ? 'border-foreground/20 bg-foreground/[0.04] ring-1 ring-foreground/20'
                      : 'border-border bg-card',
                  )}
                >
                  <span className="text-[32px] leading-none">{card.emoji}</span>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isSelected && !isDisabled
                        ? 'text-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {card.label}
                  </span>

                  {/* Coming Soon badge */}
                  {isDisabled && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2 text-[10px] px-1.5 py-0"
                    >
                      Coming Soon
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession} disabled={!selectedType || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Start'
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default IngestWizard;
