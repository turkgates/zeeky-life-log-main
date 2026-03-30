import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return setIsAdmin(false);
      const { data } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      setIsAdmin(data?.is_admin || false);
    };
    void checkAdmin();
  }, [user?.id]);

  if (isAdmin === null) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};
