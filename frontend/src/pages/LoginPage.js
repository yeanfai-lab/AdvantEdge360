import React from 'react';
import { Button } from '../components/ui/button';
import { LogIn } from 'lucide-react';

export const LoginPage = () => {
  const handleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-900 relative"
    >
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="bg-card rounded-lg shadow-xl p-8 border">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4 bg-slate-900 rounded-lg p-4">
              <img src="/logo.png" alt="AdvantEdge Advisory" className="h-16 w-auto" />
            </div>
            <p className="text-muted-foreground">
              Integrated Business Operations Platform
            </p>
          </div>
          <Button
            onClick={handleLogin}
            className="w-full h-12 text-base"
            data-testid="login-button"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
        </div>
      </div>
    </div>
  );
};
