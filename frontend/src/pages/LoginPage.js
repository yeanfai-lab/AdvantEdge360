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
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: 'url(https://images.pexels.com/photos/18435276/pexels-photo-18435276.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)'
      }}
    >
      <div className="absolute inset-0 bg-primary/90 backdrop-blur-sm" />
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="bg-card rounded-lg shadow-xl p-8 border">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-heading font-bold text-foreground mb-2">
              AdvantEdge360
            </h1>
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
