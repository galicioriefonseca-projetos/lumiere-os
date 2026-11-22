import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  code?: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
      displayName?: string | null;
      photoUrl?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const activeUser = auth?.currentUser;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  return {
    error: error instanceof Error ? error.message : String(error),
    code,
    operationType,
    path,
    authInfo: {
      userId: activeUser?.uid ?? null,
      email: activeUser?.email ?? null,
      emailVerified: activeUser?.emailVerified ?? null,
      isAnonymous: activeUser?.isAnonymous ?? null,
      tenantId: activeUser?.tenantId ?? null,
      providerInfo:
        activeUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId ?? null,
          displayName: provider.displayName ?? null,
          email: provider.email ?? null,
          photoUrl: provider.photoURL ?? null,
        })) || [],
    },
  };
}

/**
 * Logs structured Firestore permission/connection diagnostics inside onSnapshot error callbacks
 * without throwing an uncaught async exception from the listener.
 */
export function reportFirestoreListenerError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}
