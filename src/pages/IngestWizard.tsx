import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useIngestionSession } from '@/hooks/use-ingestion-session';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChefHat,
  Package,
  Wine,
  GlassWater,
  Beer,
  Pipette,
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
  bar_prep: 'prep_recipes',
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
  { key: 'bar_prep', label: 'Bar Prep', icon: Pipette, emoji: '🧪', enabled: true },
  { key: 'plate_spec', label: 'FOH/BOH Plate Spec', icon: Package, emoji: '🍽️', enabled: true },
  { key: 'wine', label: 'Wine', icon: Wine, emoji: '🍷', enabled: true },
  { key: 'cocktail', label: 'Cocktail', icon: GlassWater, emoji: '🍸', enabled: true },
  { key: 'beer_liquor', label: 'Beer/Liquor', icon: Beer, emoji: '🍺', enabled: true },
];

// =============================================================================
// COMPONENT
// =============================================================================

function IngestWizard() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { isAdmin } = useAuth();
  const { createSession } = useIngestionSession();

  const [creatingType, setCreatingType] = useState<ProductType | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleTileClick = async (type: ProductType) => {
    if (creatingType) return;
    setCreatingType(type);
    try {
      const tableName = PRODUCT_TABLE_MAP[type];
      const sessionId = await createSession(tableName);
      if (sessionId) {
        navigate(`/admin/ingest/${sessionId}`);
      }
    } finally {
      setCreatingType(null);
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
          <div className="py-6 text-center">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
              Create Something
              <br />
              <span className="font-bold">Worth Tasting Twice</span> 🍽️
            </p>
            <p className="text-sm text-muted-foreground mt-2">Recipes, plating guides, and pairings — all in one place.</p>
          </div>

          {/* Product type grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PRODUCT_TYPE_CARDS.map((card) => {
              const isDisabled = !card.enabled;
              const isLoading = creatingType === card.key;

              return (
                <button
                  key={card.key}
                  type="button"
                  disabled={isDisabled || !!creatingType}
                  onClick={() => handleTileClick(card.key)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-4 rounded-xl border px-5 py-12 text-center transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isDisabled && 'opacity-50 cursor-not-allowed',
                    !isDisabled && !creatingType && 'cursor-pointer hover:bg-accent/50',
                    isLoading && 'border-foreground/20 bg-foreground/[0.04] ring-1 ring-foreground/20',
                    !isLoading && 'border-border bg-card',
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="text-[48px] leading-none">{card.emoji}</span>
                  )}
                  <span className="text-sm font-medium text-foreground">
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

        </div>
      </div>
    </AppShell>
  );
}

export default IngestWizard;
