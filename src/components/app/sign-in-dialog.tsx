'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { signInAction, signUpAction } from '@/server/actions';

/**
 * Sign In dialog — email/password against the local user table (scrypt
 * hashes), session set as an HMAC cookie. Mirrors the reference app's
 * welcome screen; account creation is offered inline.
 */
export function SignInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result =
      mode === 'signin'
        ? await signInAction({ email, password })
        : await signUpAction({ email, password, name: name || undefined });
    setSubmitting(false);

    if (result.ok) {
      toast({ title: mode === 'signin' ? 'Signed in' : 'Account created', description: `Welcome, ${result.data.email}` });
      onOpenChange(false);
      setPassword('');
      router.refresh();
    } else {
      toast({ title: 'Authentication failed', description: result.message, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Welcome to Supply Chain Management app</DialogTitle>
          <DialogDescription>Sign in to continue</DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full border-[#dfdfdf] bg-white font-medium"
          onClick={() =>
            toast({
              title: 'Google sign-in',
              description: 'OAuth is not configured in this deployment — use email and password.',
            })
          }
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.91a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-[#dfdfdf]" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-[#dfdfdf]" />
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {mode === 'signup' && (
            <div className="grid gap-1.5">
              <Label htmlFor="si-name">Name</Label>
              <Input id="si-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="si-email">Email</Label>
            <Input
              id="si-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="si-password">Password</Label>
            <Input
              id="si-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() =>
              toast({
                title: 'Password reset',
                description: 'Self-service reset is not configured — contact your workspace administrator.',
              })
            }
          >
            Forgot password?
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setPassword('');
            }}
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
