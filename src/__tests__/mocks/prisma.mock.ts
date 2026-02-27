/**
 * Mock PrismaService for testing
 */

export class MockPrismaService {
  // In-memory stores
  private users = new Map();
  private nip05s = new Map();
  private authChallenges = new Map();
  private sessions = new Map();
  private subscriptions = new Map();
  private payments = new Map();
  private auditLogs: any[] = [];
  private domains = new Map();
  private lnurlSessions = new Map();

  // User operations
  user = {
    findUnique: jest.fn(async ({ where, include }) => {
      const user = this.users.get(where.pubkey || where.id);
      if (!user) return null;
      
      const result = { ...user };
      if (include?.subscription && user.subscriptionId) {
        result.subscription = this.subscriptions.get(user.subscriptionId);
      }
      if (include?.nip05s) {
        result.nip05s = Array.from(this.nip05s.values()).filter(
          (n: any) => n.userId === user.id && n.isActive
        );
      }
      if (include?.sessions) {
        result.sessions = Array.from(this.sessions.values()).filter(
          (s: any) => s.userId === user.id
        );
      }
      return result;
    }),
    
    create: jest.fn(async ({ data, include }) => {
      const id = `user_${Date.now()}_${Math.random()}`;
      const user = { id, ...data };
      
      // Handle nested subscription creation
      if (data.subscription?.create) {
        const subId = `sub_${Date.now()}_${Math.random()}`;
        const subscription = { id: subId, userId: id, ...data.subscription.create };
        this.subscriptions.set(subId, subscription);
        user.subscriptionId = subId;
        if (include?.subscription) {
          user.subscription = subscription;
        }
      }
      
      this.users.set(data.pubkey, user);
      return user;
    }),
  };

  // NIP-05 operations
  nip05 = {
    findFirst: jest.fn(async ({ where, include }) => {
      const nip05 = Array.from(this.nip05s.values()).find(
        (n: any) => {
          if (n.localPart !== where.localPart || n.domain !== where.domain) return false;
          if (where.isActive !== undefined && n.isActive !== where.isActive) return false;
          
          // Check user ownership if specified
          if (where.user?.pubkey) {
            const user = Array.from(this.users.values()).find((u: any) => u.pubkey === where.user.pubkey);
            if (!user || n.userId !== user.id) return false;
          }
          
          return true;
        }
      );
      
      if (!nip05) return null;
      
      if (include?.user) {
        const user = Array.from(this.users.values()).find((u: any) => u.id === nip05.userId);
        return { ...nip05, user };
      }
      
      return nip05;
    }),
    
    findMany: jest.fn(async ({ where }) => {
      return Array.from(this.nip05s.values()).filter((n: any) => {
        if (where.user?.pubkey) {
          const user = Array.from(this.users.values()).find((u: any) => u.pubkey === where.user.pubkey);
          if (!user || n.userId !== user.id) return false;
        }
        if (where.isActive !== undefined && n.isActive !== where.isActive) return false;
        return true;
      });
    }),
    
    create: jest.fn(async ({ data, include }) => {
      const id = `nip05_${Date.now()}_${Math.random()}`;
      const nip05 = {
        id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.nip05s.set(id, nip05);
      
      if (include?.user) {
        const user = Array.from(this.users.values()).find((u: any) => u.id === data.userId);
        nip05.user = user;
      }
      
      return nip05;
    }),
    
    update: jest.fn(async ({ where, data }) => {
      const nip05 = this.nip05s.get(where.id);
      if (!nip05) throw new Error('NIP-05 not found');
      Object.assign(nip05, data);
      return nip05;
    }),
  };

  // Auth challenge operations
  authChallenge = {
    create: jest.fn(async ({ data }) => {
      const challenge = {
        id: `challenge_${Date.now()}`,
        createdAt: new Date(),
        ...data,
      };
      this.authChallenges.set(data.challenge, challenge);
      return challenge;
    }),
    
    findUnique: jest.fn(async ({ where }) => {
      return this.authChallenges.get(where.challenge) || null;
    }),
    
    update: jest.fn(async ({ where, data }) => {
      const challenge = this.authChallenges.get(where.challenge);
      if (!challenge) throw new Error('Challenge not found');
      Object.assign(challenge, data);
      return challenge;
    }),
    
    deleteMany: jest.fn(async () => ({ count: 0 })),
  };

  // Session operations
  session = {
    create: jest.fn(async ({ data }) => {
      const id = `session_${Date.now()}_${Math.random()}`;
      const session = {
        id,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        ...data,
      };
      this.sessions.set(data.token, session);
      return session;
    }),
    
    findFirst: jest.fn(async ({ where, include }) => {
      const session = Array.from(this.sessions.values()).find((s: any) => {
        if (where.token && s.token !== where.token) return false;
        if (where.expiresAt?.gt && s.expiresAt <= where.expiresAt.gt) return false;
        if (where.id && s.id !== where.id) return false;
        if (where.user?.pubkey) {
          const user = Array.from(this.users.values()).find((u: any) => u.pubkey === where.user.pubkey);
          if (!user || s.userId !== user.id) return false;
        }
        return true;
      });
      
      if (!session) return null;
      
      if (include?.user) {
        const user = Array.from(this.users.values()).find((u: any) => u.id === session.userId);
        return { ...session, user };
      }
      
      return session;
    }),
    
    update: jest.fn(async ({ where, data }) => {
      const session = this.sessions.get(where.token) || 
        Array.from(this.sessions.values()).find((s: any) => s.id === where.id);
      if (!session) throw new Error('Session not found');
      Object.assign(session, data);
      return session;
    }),
    
    delete: jest.fn(async ({ where }) => {
      const session = Array.from(this.sessions.values()).find((s: any) => s.id === where.id);
      if (session) {
        this.sessions.delete(session.token);
      }
      return session;
    }),
    
    deleteMany: jest.fn(async ({ where }) => {
      let count = 0;
      for (const [token, session] of this.sessions.entries()) {
        if (where.token === session.token) {
          this.sessions.delete(token);
          count++;
        }
      }
      return { count };
    }),
  };

  // Subscription operations
  subscription = {
    update: jest.fn(async ({ where, data }) => {
      const subscription = this.subscriptions.get(where.id);
      if (!subscription) throw new Error('Subscription not found');
      Object.assign(subscription, data);
      return subscription;
    }),
  };

  // Payment operations
  payment = {
    create: jest.fn(async ({ data }) => {
      const id = `payment_${Date.now()}_${Math.random()}`;
      const payment = {
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.payments.set(id, payment);
      return payment;
    }),
    
    findUnique: jest.fn(async ({ where, include }) => {
      const payment = this.payments.get(where.id) || 
        Array.from(this.payments.values()).find((p: any) => p.paymentHash === where.paymentHash);
      
      if (!payment) return null;
      
      if (include?.subscription) {
        payment.subscription = this.subscriptions.get(payment.subscriptionId);
        if (include.subscription.include?.user) {
          const user = Array.from(this.users.values()).find(
            (u: any) => u.id === payment.subscription.userId
          );
          payment.subscription.user = user;
        }
      }
      
      return payment;
    }),
    
    findFirst: jest.fn(async ({ where, include }) => {
      const match = (payment: any, criteria: any) => {
        if (!criteria) return true;

        if (criteria.OR && Array.isArray(criteria.OR)) {
          return criteria.OR.some((sub: any) => match(payment, sub));
        }

        if (criteria.paymentHash && payment.paymentHash !== criteria.paymentHash) return false;
        if (criteria.status && payment.status !== criteria.status) return false;
        if (criteria.providerInvoiceId && payment.providerInvoiceId !== criteria.providerInvoiceId) return false;
        if (criteria.lnbitsPaymentId && payment.lnbitsPaymentId !== criteria.lnbitsPaymentId) return false;
        return true;
      };

      const payment = Array.from(this.payments.values()).find((p: any) => match(p, where));
      
      if (!payment) return null;
      
      if (include?.subscription) {
        payment.subscription = this.subscriptions.get(payment.subscriptionId);
      }
      
      return payment;
    }),
    
    update: jest.fn(async ({ where, data }) => {
      const payment = this.payments.get(where.id);
      if (!payment) throw new Error('Payment not found');
      Object.assign(payment, data, { updatedAt: new Date() });
      return payment;
    }),

    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      for (const payment of this.payments.values()) {
        const matches = (!where?.id || payment.id === where.id) && (!where?.status || payment.status === where.status);
        if (matches) {
          Object.assign(payment, data, { updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    }),
  };

  // Audit log operations
  auditLog = {
    create: jest.fn(async ({ data }) => {
      const log = {
        id: `audit_${Date.now()}`,
        createdAt: new Date(),
        ...data,
      };
      this.auditLogs.push(log);
      return log;
    }),
    
    findFirst: jest.fn(async ({ where, orderBy }) => {
      const logs = this.auditLogs.filter((log: any) => {
        if (where.action && log.action !== where.action) return false;
        if (where.entityId && log.entityId !== where.entityId) return false;
        return true;
      });
      
      if (orderBy?.createdAt === 'desc') {
        logs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      }
      
      return logs[0] || null;
    }),
  };

  // Domain operations
  domain = {
    findUnique: jest.fn(async ({ where }) => {
      return this.domains.get(where.domain) || null;
    }),
    
    findFirst: jest.fn(async ({ where }) => {
      return Array.from(this.domains.values()).find((d: any) => {
        if (where.domain && d.domain !== where.domain) return false;
        if (where.ownerPubkey && d.ownerPubkey !== where.ownerPubkey) return false;
        if (where.verified !== undefined && d.verified !== where.verified) return false;
        return true;
      });
    }),
    
    create: jest.fn(async ({ data }) => {
      const domain = {
        id: `domain_${Date.now()}`,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.domains.set(data.domain, domain);
      return domain;
    }),
  };

  // LNURL session operations
  lnurlSession = {
    create: jest.fn(async ({ data }) => {
      const session = {
        id: `lnurl_${Date.now()}`,
        createdAt: new Date(),
        ...data,
      };
      this.lnurlSessions.set(data.k1, session);
      return session;
    }),
    
    findUnique: jest.fn(async ({ where }) => {
      return this.lnurlSessions.get(where.k1) || null;
    }),
    
    update: jest.fn(async ({ where, data }) => {
      const session = this.lnurlSessions.get(where.k1);
      if (!session) throw new Error('LNURL session not found');
      Object.assign(session, data);
      return session;
    }),
  };

  // Utility methods for tests
  reset() {
    this.users.clear();
    this.nip05s.clear();
    this.authChallenges.clear();
    this.sessions.clear();
    this.subscriptions.clear();
    this.payments.clear();
    this.auditLogs = [];
    this.domains.clear();
    this.lnurlSessions.clear();
  }

  seed(data: any) {
    if (data.users) {
      data.users.forEach((user: any) => this.users.set(user.pubkey, user));
    }
    if (data.nip05s) {
      data.nip05s.forEach((nip05: any) => this.nip05s.set(nip05.id, nip05));
    }
  }
}

export const createMockPrismaService = () => new MockPrismaService();
