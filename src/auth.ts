/*
 * Copyright (C) 2024-2026 EDUmind - Los Mundos Edufis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts';
import type { AccountTier } from './types'

export interface UserProfile {
    id: string
    email: string
    tier: AccountTier
    displayName?: string
}

const isLocalUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REDIRECT_URI = isLocalUrl ? 'http://localhost:5173/callback' : 'https://motion.edumind.es/callback';

const userManager = new UserManager({
    authority: 'https://auth.edumind.es/application/o/motion-v1/',
    client_id: '91c7eca1b29c43c90ea1eb5d96747d51',
    redirect_uri: REDIRECT_URI,
    post_logout_redirect_uri: isLocalUrl ? 'http://localhost:5173/' : 'https://motion.edumind.es/',
    response_type: 'code',
    scope: 'openid profile email offline_access',
    userStore: new WebStorageStateStore({ store: window.localStorage }),
});

export class AuthManager {
    private static readonly SHELL_URL = 'https://edumind.es/dashboard';

    private user: User | null = null;
    private userTier: AccountTier = 'free';
    private listeners: Set<(isAuthenticated: boolean) => void> = new Set();
    private isInitialized = false;

    constructor() {
        this.init();
    }

    private async init() {
        try {
            if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
                this.user = (await userManager.signinCallback()) || null;
                window.history.replaceState({}, document.title, window.location.pathname);
            } else {
                this.user = await userManager.getUser();
            }

            this.evaluateTier();
        } catch (e) {
            console.error('OIDC Auth Error:', e);
            // In case of invalid state, just swallow and clean session to allow fresh login
            await userManager.removeUser();
        } finally {
            this.isInitialized = true;
            this.notifyListeners();
        }
    }

    private evaluateTier() {
        if (!this.user) {
            this.userTier = 'free';
            return;
        }

        const claims = this.user.profile as any;
        const groups = claims.groups || [];
        const entitlements = claims.entitlements || [];
        const allRoles = [...groups, ...entitlements].map((r: string) => r.toLowerCase());
        
        const premiumGroups = ['premium', 'pro', 'staff', 'admin', 'team', 'subscription:premium'];
        
        if (allRoles.some((g: string) => premiumGroups.some(p => g.includes(p)))) {
            this.userTier = 'premium';
            localStorage.setItem('edumind_tier', 'premium'); // Backwards compatibility for other local scripts if any
        } else {
            // Check fallback for local dev overrides
            const stored = localStorage.getItem('edumind_tier');
            this.userTier = stored === 'premium' ? 'premium' : 'free';
        }
    }

    public isAuthenticated(): boolean {
        return !!this.user && !this.user.expired;
    }

    public getTier(): AccountTier {
        return this.isAuthenticated() ? this.userTier : 'free';
    }

    public isPremium(): boolean {
        return this.getTier() === 'premium';
    }

    public login() {
        userManager.signinRedirect().catch(console.error);
    }

    public logout() {
        localStorage.removeItem('edumind_tier');
        this.user = null;
        this.userTier = 'free';
        this.notifyListeners();
        userManager.signoutRedirect().catch(console.error);
    }

    public getShellUrl(): string {
        return AuthManager.SHELL_URL;
    }

    public subscribe(listener: (isAuthenticated: boolean) => void) {
        this.listeners.add(listener);
        if (this.isInitialized) {
            listener(this.isAuthenticated());
        }
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        const status = this.isAuthenticated();
        this.listeners.forEach(l => l(status));
    }
}

export const authManager = new AuthManager();
