'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleLogout}
      className="ml-auto"
    >
      Logout
    </Button>
  );
}