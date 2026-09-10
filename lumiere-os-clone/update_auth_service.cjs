const fs = require('fs');

let content = fs.readFileSync('src/services/AuthService.ts', 'utf8');

const newFunctions = `
  async signInWithGoogleForRegister(
    _salonFields: {
      salonName: string;
      businessType: string;
      city: string;
      state: string;
      phone: string;
      plan: string;
      limit: number;
      ownerName?: string;
      businessSegment?: string;
      estimatedProfessionals?: string;
      recommendedPlan?: string;
    },
    optionalFullName?: string
  ): Promise<AuthUser> {
    const provider = new GoogleAuthProvider();
    const activeAuth = getAuth();
    const result = await signInWithPopup(activeAuth, provider);
    const user = result.user;
    const now = Date.now();
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        fullName: optionalFullName || user.displayName || '',
        name: optionalFullName || user.displayName || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
        role: 'pending',
        salonId: null,
        onboardingStatus: 'pending_payment',
        createdAt: now,
        updatedAt: now,
      });
    }

    sessionStorage.removeItem('demo_role');
    return user;
  },

  async signInWithGoogleForInvite(
    inviteData: any,
    phone?: string,
    optionalFullName?: string,
    choices?: { primaryFunction?: string; additionalFunctions?: string[] }
  ): Promise<{ user: AuthUser; idToken: string; }> {
    const provider = new GoogleAuthProvider();
    const activeAuth = getAuth();
    const result = await signInWithPopup(activeAuth, provider);
    const user = result.user;

    const fullName = optionalFullName || user.displayName || inviteData.fullName || user.displayName || '';
    const idToken = await user.getIdToken(true);

    const response = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${idToken}\`
      },
      body: JSON.stringify({
        inviteId: inviteData.inviteId || inviteData.id,
        fullName: fullName,
        phone: phone || "",
        primaryFunction: choices?.primaryFunction || "",
        additionalFunctions: choices?.additionalFunctions || []
      })
    });

    const data = await response.json();
    if (!response.ok) {
       await signOut(activeAuth);
       const errorCode = data.code === 'auth/invite-email-mismatch' ? 'auth/invite-email-mismatch' : 'auth/invite-accept-failed';
       throw Object.assign(new Error(data.error || 'Erro ao aceitar convite'), { code: errorCode, invitedEmail: inviteData.email || inviteData.maskedEmail });
    }

    sessionStorage.removeItem('demo_role');
    return { user, idToken };
  }
};
`;

content = content.replace('};', newFunctions);
fs.writeFileSync('src/services/AuthService.ts', content);

let contextContent = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

const regStart = contextContent.indexOf('const signInWithGoogleForRegister = async (');
const invEnd = contextContent.indexOf('const isDemoActive = DEMO_MODE_ENABLED');

const replaced = `const signInWithGoogleForRegister = async (
    _salonFields: {
      salonName: string;
      businessType: string;
      city: string;
      state: string;
      phone: string;
      plan: string;
      limit: number;
      ownerName?: string;
      businessSegment?: string;
      estimatedProfessionals?: string;
      recommendedPlan?: string;
    },
    optionalFullName?: string
  ): Promise<AuthUser> => {
    return AuthService.signInWithGoogleForRegister(_salonFields, optionalFullName);
  };

  const signInWithGoogleForInvite = async (
    inviteData: any,
    phone?: string,
    optionalFullName?: string,
    choices?: { primaryFunction?: string; additionalFunctions?: string[] }
  ): Promise<AuthUser> => {
    const { user } = await AuthService.signInWithGoogleForInvite(inviteData, phone, optionalFullName, choices);
    await refreshUserData();
    return user;
  };

  `;

contextContent = contextContent.substring(0, regStart) + replaced + contextContent.substring(invEnd);
fs.writeFileSync('src/contexts/AuthContext.tsx', contextContent);
