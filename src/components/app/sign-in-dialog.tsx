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
