import { z } from 'zod';
import { WorkspaceAuthError, workspaceFetch } from './googleWorkspaceService';
import type { Client, ClientAddress, ClientGender } from '@/types';

const PEOPLE_API_BASE = 'https://people.googleapis.com/v1';

export const CONTACT_PERSON_FIELDS =
  'names,emailAddresses,phoneNumbers,birthdays,addresses,genders,organizations,biographies,photos,metadata';
export const OTHER_CONTACT_READ_MASK =
  'names,emailAddresses,phoneNumbers,photos,metadata';
export const DIRECTORY_READ_MASK =
  'names,emailAddresses,phoneNumbers,organizations,photos';
export const ME_PERSON_FIELDS =
  'names,emailAddresses,phoneNumbers,birthdays,addresses,genders,organizations,photos';

export type GoogleContactSource = 'contacts' | 'other' | 'directory' | 'me';

export interface GoogleContactPerson {
  resourceName: string;
  etag?: string;
  source: GoogleContactSource;
  displayName: string;
  givenName?: string;
  familyName?: string;
  primaryPhone?: string;
  phoneNumbers: Array<{ value: string; type?: string }>;
  primaryEmail?: string;
  emailAddresses: Array<{ value: string; type?: string }>;
  birthDate?: string; // YYYY-MM-DD
  gender?: ClientGender | '';
  genderLabel?: string;
  address?: ClientAddress;
  formattedAddress?: string;
  organization?: string;
  jobTitle?: string;
  notes?: string;
  photoUrl?: string;
}

export interface GoogleContactsListResult {
  contacts: GoogleContactPerson[];
  nextPageToken?: string;
  totalItems?: number;
  directoryUnavailable?: boolean;
}

export const googleContactFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Informe o nome do contato (mínimo 2 caracteres).')
    .max(120, 'Nome muito longo.'),
  phone: z.string().trim().max(40).optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: 'Informe um e-mail válido.' }
    ),
  birthDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      { message: 'Data de aniversário inválida (AAAA-MM-DD).' }
    ),
  gender: z.enum(['', 'female', 'male', 'other', 'prefer_not_to_say']).optional(),
  organization: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  zipCode: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type GoogleContactFormInput = z.infer<typeof googleContactFormSchema>;

interface RawPerson {
  resourceName?: string;
  etag?: string;
  names?: Array<{
    displayName?: string;
    givenName?: string;
    familyName?: string;
    metadata?: { primary?: boolean };
  }>;
  phoneNumbers?: Array<{
    value?: string;
    canonicalForm?: string;
    type?: string;
    metadata?: { primary?: boolean };
  }>;
  emailAddresses?: Array<{
    value?: string;
    type?: string;
    metadata?: { primary?: boolean };
  }>;
  birthdays?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
    text?: string;
  }>;
  genders?: Array<{
    value?: string;
    formattedValue?: string;
  }>;
  addresses?: Array<{
    formattedValue?: string;
    streetAddress?: string;
    extendedAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    type?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
    department?: string;
  }>;
  biographies?: Array<{
    value?: string;
  }>;
  photos?: Array<{
    url?: string;
    default?: boolean;
  }>;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function parseRawBirthday(birthdays?: RawPerson['birthdays']): string | undefined {
  if (!birthdays || birthdays.length === 0) return undefined;
  const dateObj = birthdays.find((b) => b.date?.month && b.date?.day)?.date;
  if (!dateObj || !dateObj.month || !dateObj.day) return undefined;
  const year = dateObj.year && dateObj.year > 1900 ? dateObj.year : 2000;
  return `${year}-${padTwo(dateObj.month)}-${padTwo(dateObj.day)}`;
}

function parseRawGender(
  genders?: RawPerson['genders']
): { gender: ClientGender | ''; label?: string } {
  if (!genders || genders.length === 0) return { gender: '' };
  const raw = (genders[0].value || '').toLowerCase();
  if (raw === 'female') return { gender: 'female', label: genders[0].formattedValue || 'Feminino' };
  if (raw === 'male') return { gender: 'male', label: genders[0].formattedValue || 'Masculino' };
  if (raw === 'unspecified') {
    return { gender: 'prefer_not_to_say', label: genders[0].formattedValue || 'Prefiro não informar' };
  }
  if (raw) {
    return { gender: 'other', label: genders[0].formattedValue || raw };
  }
  return { gender: '' };
}

function normalizePerson(raw: RawPerson, source: GoogleContactSource): GoogleContactPerson {
  const primaryName =
    raw.names?.find((n) => n.metadata?.primary) || raw.names?.[0];

  const phoneNumbers = (raw.phoneNumbers || [])
    .filter((p) => Boolean(p.value || p.canonicalForm))
    .map((p) => ({
      value: (p.value || p.canonicalForm || '').trim(),
      type: p.type,
    }));

  const primaryPhoneObj =
    raw.phoneNumbers?.find((p) => p.metadata?.primary) || raw.phoneNumbers?.[0];
  const primaryPhone = (primaryPhoneObj?.value || primaryPhoneObj?.canonicalForm || '').trim() || undefined;

  const emailAddresses = (raw.emailAddresses || [])
    .filter((e) => Boolean(e.value))
    .map((e) => ({
      value: (e.value || '').trim(),
      type: e.type,
    }));

  const primaryEmailObj =
    raw.emailAddresses?.find((e) => e.metadata?.primary) || raw.emailAddresses?.[0];
  const primaryEmail = primaryEmailObj?.value?.trim() || undefined;

  const rawAddress = raw.addresses?.[0];
  const address: ClientAddress | undefined = rawAddress
    ? {
        street: rawAddress.streetAddress || undefined,
        complement: rawAddress.extendedAddress || undefined,
        city: rawAddress.city || undefined,
        state: rawAddress.region || undefined,
        zipCode: rawAddress.postalCode || undefined,
      }
    : undefined;

  const org = raw.organizations?.[0];
  const genderParsed = parseRawGender(raw.genders);
  const photo = raw.photos?.find((p) => !p.default) || raw.photos?.[0];

  const fallbackName =
    primaryName?.displayName?.trim() ||
    [primaryName?.givenName, primaryName?.familyName].filter(Boolean).join(' ').trim() ||
    primaryEmail ||
    primaryPhone ||
    'Contato sem nome';

  return {
    resourceName: raw.resourceName || '',
    etag: raw.etag,
    source,
    displayName: fallbackName,
    givenName: primaryName?.givenName,
    familyName: primaryName?.familyName,
    primaryPhone,
    phoneNumbers,
    primaryEmail,
    emailAddresses,
    birthDate: parseRawBirthday(raw.birthdays),
    gender: genderParsed.gender,
    genderLabel: genderParsed.label,
    address,
    formattedAddress: rawAddress?.formattedValue,
    organization: org?.name || undefined,
    jobTitle: org?.title || undefined,
    notes: raw.biographies?.[0]?.value?.trim() || undefined,
    photoUrl: photo?.url || undefined,
  };
}

function splitDisplayName(fullName: string): { givenName: string; familyName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { givenName: fullName.trim() };
  }
  const givenName = parts[0];
  const familyName = parts.slice(1).join(' ');
  return { givenName, familyName };
}

function buildPersonPayload(input: GoogleContactFormInput): Record<string, unknown> {
  const validated = googleContactFormSchema.parse(input);
  const { givenName, familyName } = splitDisplayName(validated.displayName);

  const payload: Record<string, unknown> = {
    names: [
      {
        givenName,
        ...(familyName ? { familyName } : {}),
      },
    ],
  };

  if (validated.phone?.trim()) {
    payload.phoneNumbers = [
      {
        value: validated.phone.trim(),
        type: 'mobile',
      },
    ];
  } else {
    payload.phoneNumbers = [];
  }

  if (validated.email?.trim()) {
    payload.emailAddresses = [
      {
        value: validated.email.trim(),
        type: 'work',
      },
    ];
  } else {
    payload.emailAddresses = [];
  }

  if (validated.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(validated.birthDate)) {
    const [yearStr, monthStr, dayStr] = validated.birthDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      payload.birthdays = [
        {
          date: {
            ...(year > 1900 ? { year } : {}),
            month,
            day,
          },
        },
      ];
    }
  } else {
    payload.birthdays = [];
  }

  if (validated.gender) {
    const mappedGender =
      validated.gender === 'prefer_not_to_say' ? 'unspecified' : validated.gender;
    payload.genders = [{ value: mappedGender }];
  } else {
    payload.genders = [];
  }

  if (validated.organization?.trim() || validated.jobTitle?.trim()) {
    payload.organizations = [
      {
        ...(validated.organization?.trim() ? { name: validated.organization.trim() } : {}),
        ...(validated.jobTitle?.trim() ? { title: validated.jobTitle.trim() } : {}),
      },
    ];
  } else {
    payload.organizations = [];
  }

  if (
    validated.street?.trim() ||
    validated.city?.trim() ||
    validated.state?.trim() ||
    validated.zipCode?.trim()
  ) {
    payload.addresses = [
      {
        type: 'home',
        ...(validated.street?.trim() ? { streetAddress: validated.street.trim() } : {}),
        ...(validated.city?.trim() ? { city: validated.city.trim() } : {}),
        ...(validated.state?.trim() ? { region: validated.state.trim() } : {}),
        ...(validated.zipCode?.trim() ? { postalCode: validated.zipCode.trim() } : {}),
      },
    ];
  } else {
    payload.addresses = [];
  }

  if (validated.notes?.trim()) {
    payload.biographies = [{ value: validated.notes.trim(), contentType: 'TEXT_PLAIN' }];
  } else {
    payload.biographies = [];
  }

  return payload;
}

export async function fetchMyPeopleProfile(): Promise<GoogleContactPerson> {
  const params = new URLSearchParams({
    personFields: ME_PERSON_FIELDS,
  });
  const data = await workspaceFetch<RawPerson>(
    `${PEOPLE_API_BASE}/people/me?${params.toString()}`
  );
  return normalizePerson(data, 'me');
}

export async function listGoogleContacts(pageToken?: string): Promise<GoogleContactsListResult> {
  const params = new URLSearchParams({
    personFields: CONTACT_PERSON_FIELDS,
    pageSize: '100',
    sortOrder: 'FIRST_NAME_ASCENDING',
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const data = await workspaceFetch<{
    connections?: RawPerson[];
    nextPageToken?: string;
    totalItems?: number;
  }>(`${PEOPLE_API_BASE}/people/me/connections?${params.toString()}`);

  return {
    contacts: (data.connections || []).map((p) => normalizePerson(p, 'contacts')),
    nextPageToken: data.nextPageToken,
    totalItems: data.totalItems,
  };
}

export async function searchGoogleContacts(queryText: string): Promise<GoogleContactPerson[]> {
  const trimmed = queryText.trim();
  if (!trimmed) {
    const res = await listGoogleContacts();
    return res.contacts;
  }

  const params = new URLSearchParams({
    query: trimmed,
    readMask: CONTACT_PERSON_FIELDS,
    pageSize: '30',
  });

  const data = await workspaceFetch<{
    results?: Array<{ person?: RawPerson }>;
  }>(`${PEOPLE_API_BASE}/people:searchContacts?${params.toString()}`);

  return (data.results || [])
    .map((item) => item.person)
    .filter((p): p is RawPerson => Boolean(p))
    .map((p) => normalizePerson(p, 'contacts'));
}

export async function listOtherContacts(
  pageToken?: string,
  queryText?: string
): Promise<GoogleContactsListResult> {
  const trimmed = queryText?.trim();
  if (trimmed) {
    const params = new URLSearchParams({
      query: trimmed,
      readMask: OTHER_CONTACT_READ_MASK,
      pageSize: '30',
    });
    const data = await workspaceFetch<{
      results?: Array<{ person?: RawPerson }>;
    }>(`${PEOPLE_API_BASE}/otherContacts:search?${params.toString()}`);

    return {
      contacts: (data.results || [])
        .map((item) => item.person)
        .filter((p): p is RawPerson => Boolean(p))
        .map((p) => normalizePerson(p, 'other')),
    };
  }

  const params = new URLSearchParams({
    readMask: OTHER_CONTACT_READ_MASK,
    pageSize: '100',
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const data = await workspaceFetch<{
    otherContacts?: RawPerson[];
    nextPageToken?: string;
  }>(`${PEOPLE_API_BASE}/otherContacts?${params.toString()}`);

  return {
    contacts: (data.otherContacts || []).map((p) => normalizePerson(p, 'other')),
    nextPageToken: data.nextPageToken,
  };
}

export async function listDirectoryContacts(
  pageToken?: string,
  queryText?: string
): Promise<GoogleContactsListResult> {
  try {
    const trimmed = queryText?.trim();
    if (trimmed) {
      const params = new URLSearchParams({
        query: trimmed,
        readMask: DIRECTORY_READ_MASK,
        sources: 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE',
        pageSize: '30',
      });
      const data = await workspaceFetch<{
        people?: RawPerson[];
        nextPageToken?: string;
      }>(`${PEOPLE_API_BASE}/people:searchDirectoryPeople?${params.toString()}`);

      return {
        contacts: (data.people || []).map((p) => normalizePerson(p, 'directory')),
        nextPageToken: data.nextPageToken,
      };
    }

    const params = new URLSearchParams({
      readMask: DIRECTORY_READ_MASK,
      sources: 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE',
      pageSize: '100',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const data = await workspaceFetch<{
      people?: RawPerson[];
      nextPageToken?: string;
    }>(`${PEOPLE_API_BASE}/people:listDirectoryPeople?${params.toString()}`);

    return {
      contacts: (data.people || []).map((p) => normalizePerson(p, 'directory')),
      nextPageToken: data.nextPageToken,
    };
  } catch (err) {
    if (err instanceof WorkspaceAuthError) {
      throw err;
    }
    return {
      contacts: [],
      directoryUnavailable: true,
    };
  }
}

export async function createGoogleContact(
  input: GoogleContactFormInput
): Promise<GoogleContactPerson> {
  const params = new URLSearchParams({
    personFields: CONTACT_PERSON_FIELDS,
  });
  const payload = buildPersonPayload(input);

  const created = await workspaceFetch<RawPerson>(
    `${PEOPLE_API_BASE}/people:createContact?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  return normalizePerson(created, 'contacts');
}

export async function updateGoogleContact(
  resourceName: string,
  etag: string | undefined,
  input: GoogleContactFormInput
): Promise<GoogleContactPerson> {
  if (!resourceName) {
    throw new Error('Identificador do contato do Google inválido.');
  }

  let effectiveEtag = etag;
  if (!effectiveEtag) {
    const getParams = new URLSearchParams({ personFields: CONTACT_PERSON_FIELDS });
    const latest = await workspaceFetch<RawPerson>(
      `${PEOPLE_API_BASE}/${resourceName}?${getParams.toString()}`
    );
    effectiveEtag = latest.etag;
  }

  const updateFields = [
    'names',
    'phoneNumbers',
    'emailAddresses',
    'birthdays',
    'genders',
    'organizations',
    'addresses',
    'biographies',
  ].join(',');

  const params = new URLSearchParams({
    updatePersonFields: updateFields,
    personFields: CONTACT_PERSON_FIELDS,
  });

  const payload = {
    etag: effectiveEtag,
    ...buildPersonPayload(input),
  };

  const updated = await workspaceFetch<RawPerson>(
    `${PEOPLE_API_BASE}/${resourceName}:updateContact?${params.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );

  return normalizePerson(updated, 'contacts');
}

export async function deleteGoogleContact(resourceName: string): Promise<void> {
  if (!resourceName) {
    throw new Error('Identificador do contato do Google inválido.');
  }

  await workspaceFetch<Record<string, never>>(
    `${PEOPLE_API_BASE}/${resourceName}:deleteContact`,
    {
      method: 'DELETE',
    }
  );
}

export function normalizeContactPhoneKey(phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

export function contactMatchesClient(
  contact: GoogleContactPerson,
  client: Pick<Client, 'phone' | 'secondaryPhone' | 'email'>
): boolean {
  const contactEmail = contact.primaryEmail?.trim().toLowerCase();
  const clientEmail = client.email?.trim().toLowerCase();
  if (contactEmail && clientEmail && contactEmail === clientEmail) {
    return true;
  }

  const clientPhoneKeys = [
    normalizeContactPhoneKey(client.phone),
    normalizeContactPhoneKey(client.secondaryPhone),
  ].filter((k) => k.length >= 8);

  if (clientPhoneKeys.length === 0) return false;

  const contactPhoneKeys = [
    normalizeContactPhoneKey(contact.primaryPhone),
    ...contact.phoneNumbers.map((p) => normalizeContactPhoneKey(p.value)),
  ].filter((k) => k.length >= 8);

  return contactPhoneKeys.some((k) => clientPhoneKeys.includes(k));
}

export function googleContactToFormInput(
  contact: GoogleContactPerson
): GoogleContactFormInput {
  return {
    displayName: contact.displayName || '',
    phone: contact.primaryPhone || '',
    email: contact.primaryEmail || '',
    birthDate: contact.birthDate || '',
    gender: contact.gender || '',
    organization: contact.organization || '',
    jobTitle: contact.jobTitle || '',
    street: contact.address?.street || '',
    city: contact.address?.city || '',
    state: contact.address?.state || '',
    zipCode: contact.address?.zipCode || '',
    notes: contact.notes || '',
  };
}

export function clientToGoogleContactInput(
  client: Client,
  salonName?: string
): GoogleContactFormInput {
  const noteParts: string[] = [];
  if (client.notes?.trim()) noteParts.push(client.notes.trim());
  if (Array.isArray(client.tags) && client.tags.length > 0) {
    noteParts.push(`Tags CRM: ${client.tags.join(', ')}`);
  }
  if (salonName?.trim()) {
    noteParts.push(`Importado do LumièreOS (${salonName.trim()})`);
  }

  const validGender: GoogleContactFormInput['gender'] =
    client.gender === 'female' ||
    client.gender === 'male' ||
    client.gender === 'other' ||
    client.gender === 'prefer_not_to_say'
      ? client.gender
      : '';

  const streetCombined = [
    client.address?.street,
    client.address?.number,
    client.address?.complement,
    client.address?.neighborhood,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    displayName: client.name || '',
    phone: client.phone || client.secondaryPhone || '',
    email: client.email || '',
    birthDate:
      client.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(client.birthDate)
        ? client.birthDate
        : '',
    gender: validGender,
    organization: salonName?.trim() ? `Cliente · ${salonName.trim()}` : 'Cliente LumièreOS',
    jobTitle: '',
    street: streetCombined,
    city: client.address?.city || '',
    state: client.address?.state || '',
    zipCode: client.address?.zipCode || '',
    notes: noteParts.join('\n').slice(0, 1900),
  };
}

export function googleContactToClientDraft(contact: GoogleContactPerson): {
  name: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  gender: string;
  birthDate: string;
  address: ClientAddress;
  notes: string;
} {
  const primaryPhone = contact.primaryPhone || contact.phoneNumbers[0]?.value || '';
  const secondaryPhone =
    contact.phoneNumbers.find((p) => p.value !== primaryPhone)?.value || '';

  return {
    name: contact.displayName || 'Contato Google',
    phone: primaryPhone,
    secondaryPhone,
    email: contact.primaryEmail || contact.emailAddresses[0]?.value || '',
    gender: contact.gender || '',
    birthDate: contact.birthDate || '',
    address: contact.address || {},
    notes: [
      contact.notes || '',
      contact.organization ? `Empresa: ${contact.organization}` : '',
      contact.jobTitle ? `Cargo: ${contact.jobTitle}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}
