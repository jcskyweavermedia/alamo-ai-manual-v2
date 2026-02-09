/**
 * ProfileHeader
 * 
 * Displays user avatar, name, and email.
 * Read-only display component.
 */

import { User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionTitle, MetaText } from '@/components/ui/typography';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

interface ProfileHeaderProps {
  className?: string;
}

export function ProfileHeader({ className }: ProfileHeaderProps) {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent>
          <div className="flex items-center gap-lg">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-sm">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayName = profile?.fullName || profile?.email?.split('@')[0] || 'User';
  const email = profile?.email || '';
  const avatarUrl = profile?.avatarUrl;

  return (
    <Card className={className}>
      <CardContent>
        <div className="flex items-center gap-lg">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
          )}
          <div>
            <SectionTitle>{displayName}</SectionTitle>
            <MetaText>{email}</MetaText>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
