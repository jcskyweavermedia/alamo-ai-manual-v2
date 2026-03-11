import { useState, useMemo } from 'react';
import { Search, Trash2, Beer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BeerLiquorItem, BeerLiquorCategory } from '@/types/products';

interface BeerLiquorBuilderTableProps {
  items: BeerLiquorItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

type FilterCategory = 'All' | BeerLiquorCategory;

const FILTER_OPTIONS: FilterCategory[] = ['All', 'Beer', 'Liquor'];

export function BeerLiquorBuilderTable({
  items,
  selectedItemId,
  onSelectItem,
  onDeleteItem,
}: BeerLiquorBuilderTableProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        activeFilter === 'All' || item.category === activeFilter;
      if (!matchesCategory) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.producer.toLowerCase().includes(query) ||
        item.subcategory.toLowerCase().includes(query) ||
        item.style.toLowerCase().includes(query) ||
        item.country.toLowerCase().includes(query)
      );
    });
  }, [items, search, activeFilter]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="pl-8 pr-8 h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex items-center bg-muted p-0.5 rounded-lg gap-0.5 shrink-0">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActiveFilter(option)}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-all duration-150',
                activeFilter === option
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {/* Item count */}
      <p className="text-xs text-muted-foreground">
        {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
      </p>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 px-3" />
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Subcategory</TableHead>
              <TableHead>Producer</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="w-10 px-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  No items match your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedItemId === item.id
                      ? 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/20'
                      : 'hover:bg-muted/50'
                  )}
                >
                  {/* Image */}
                  <TableCell className="w-10 px-3 py-2">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-8 w-8 rounded-md object-cover shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Beer className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>

                  {/* Name */}
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm leading-snug">{item.name}</span>
                      {item.isFeatured && (
                        <Badge variant="secondary" className="w-fit text-[11px] px-1.5 py-0">
                          ★ Featured
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        item.category === 'Beer'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
                      )}
                    >
                      {item.category}
                    </span>
                  </TableCell>

                  {/* Subcategory */}
                  <TableCell className="text-sm">{item.subcategory}</TableCell>

                  {/* Producer */}
                  <TableCell className="text-sm text-muted-foreground">
                    {item.producer}
                  </TableCell>

                  {/* Country */}
                  <TableCell className="text-sm text-muted-foreground">
                    {item.country}
                  </TableCell>

                  {/* Delete */}
                  <TableCell className="w-10 px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      aria-label={"Delete " + item.name}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
