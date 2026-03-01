import type { RestaurantItemComparison } from '@/types/reviews';

interface TopItemsGridProps {
  title: string;
  subtitle: string;
  restaurants: RestaurantItemComparison[];
  itemKey: 'topItems' | 'worstItems';
  accentColor: string;
  isEs: boolean;
}

export function TopItemsGrid({
  title,
  subtitle,
  restaurants,
  itemKey,
  accentColor,
  isEs,
}: TopItemsGridProps) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: accentColor }}
        />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">— {subtitle}</span>
      </div>

      {/* 5-column grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {restaurants.map((restaurant) => {
          const items = restaurant[itemKey];
          return (
            <div key={restaurant.restaurantId}>
              {/* Column header */}
              <p
                className="text-xs font-bold pb-2 mb-2.5"
                style={{ borderBottom: `2px solid ${accentColor}` }}
              >
                {restaurant.name}
                {restaurant.isOwn && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ml-1 bg-[#F97316]">
                    {isEs ? 'Tú' : 'You'}
                  </span>
                )}
              </p>
              {/* Items */}
              {items.map((it, i) => (
                <div key={it.item}>
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-bold w-3"
                        style={{ color: accentColor }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[11px] text-foreground">{it.item}</span>
                    </div>
                    <span
                      className="text-[10px] font-mono font-semibold text-muted-foreground"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {it.count}
                    </span>
                  </div>
                  {i < items.length - 1 && (
                    <div className="border-b border-border" />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
