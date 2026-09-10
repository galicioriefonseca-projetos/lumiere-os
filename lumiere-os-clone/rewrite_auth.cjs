const fs = require('fs');

let content = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

// add import
content = content.replace('import { ensureTutorialSalon } from', "import { AuthService } from '../services/AuthService';\nimport { ensureTutorialSalon } from");

// replace logout function
const logoutStart = content.indexOf('const logout = async () => {');
const signInStart = content.indexOf('const signInWithGoogle = async (): Promise<AuthUser> => {');
const signInEnd = content.indexOf('const signInWithGoogleForRegister = async (');

const newLogoutAndSignIn = `const logout = async () => {
    setLoading(true);
    const userEmail = currentUser?.email || currentUser?.uid || 'Unknown';
    await AuthService.logout(userEmail);
    setUserData(null);
    setSalonData(null);
    setIsPlatformAdmin(false);
    setLoading(false);
  };

  const signInWithGoogle = async (): Promise<AuthUser> => {
    return AuthService.signInWithGoogle();
  };

  `;

content = content.substring(0, logoutStart) + newLogoutAndSignIn + content.substring(signInEnd);

fs.writeFileSync('src/contexts/AuthContext.tsx', content);
console.log('Done rewriting AuthContext.tsx');
