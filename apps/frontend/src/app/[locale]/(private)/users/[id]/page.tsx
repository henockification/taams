'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { notifications } from '@/lib/notifications';
import { ArrowLeft, AlertCircle, RotateCw, Loader2 } from 'lucide-react';
import { useAssignUserRoles, useRoles } from '@/data/hooks/rbac.hooks';

interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean | null;
  role: string[];
  createdAt: string;
  updatedAt: string;
  image: string | null;
}

interface UserResponse {
  success: boolean;
  user: User;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const { data: rolesResponse, isLoading: rolesLoading } = useRoles();
  const assignUserRoles = useAssignUserRoles();
  const roles = rolesResponse?.roles ?? [];

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3012'}/api/users/${userId}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserResponse = await response.json();
      
      if (data.success) {
        setUser(data.user);
      } else {
        throw new Error('Failed to fetch user');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      notifications.show({
        title: 'Error',
        message: `Failed to fetch user: ${errorMessage}`,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser]);

  useEffect(() => {
    if (!user || roles.length === 0) return;

    setSelectedRoleIds(
      roles
        .filter((role) => user.role.includes(role.name))
        .map((role) => role.id)
    );
  }, [roles, user]);

  const handleRefresh = () => {
    fetchUser();
  };

  const handleBack = () => {
    router.back();
  };

  const handleRoleToggle = (roleId: string, checked: boolean) => {
    setSelectedRoleIds((current) => {
      if (checked) {
        return current.includes(roleId) ? current : [...current, roleId];
      }

      return current.filter((id) => id !== roleId);
    });
  };

  const handleSaveRoles = async () => {
    if (!user) return;

    try {
      await assignUserRoles.mutateAsync({
        userId: user.id,
        roleIds: selectedRoleIds,
      });
      notifications.show({
        title: 'Success',
        message: 'User roles updated successfully',
        color: 'green',
      });
      fetchUser();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update user roles',
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Loading user details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">User not found</p>
            <Button onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="space-y-8">
        <div className="flex items-center justify-start gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback>{user.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">
                  {user.name || 'No name'}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {user.email}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                    {user.emailVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {user.role.map((role) => (
                      <Badge key={role} variant="outline">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-medium">{user.id}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Email Address</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Email Status</p>
                <Badge variant={user.emailVerified ? 'default' : 'secondary'} className="mt-1">
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Timestamps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Created At</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleString()}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{new Date(user.updatedAt).toLocaleString()}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Account Age</p>
                <p className="font-medium">
                  {Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {user.role.length > 0 ? (
                user.role.map((role) => (
                  <Badge key={role} variant="default">
                    {role}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No roles assigned</span>
              )}
            </div>

            <Separator />

            {rolesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create roles before assigning access to this user.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {roles.map((role) => (
                    <Label
                      key={role.id}
                      className="flex min-h-20 cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={(checked) => handleRoleToggle(role.id, checked === true)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="block text-sm font-medium text-foreground">
                          {role.name}
                        </span>
                        <span className="line-clamp-2 block text-xs text-muted-foreground">
                          {role.description || `${role.permissions.length} permissions`}
                        </span>
                      </span>
                    </Label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveRoles} disabled={assignUserRoles.isPending}>
                    {assignUserRoles.isPending ? 'Saving...' : 'Save roles'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
