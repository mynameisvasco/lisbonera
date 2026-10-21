const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(bytes: ArrayBuffer | Uint8Array): string {
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function randomHex(bytes = 16): string {
	return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * A high-entropy app password (~119 bits) that is still easy to type on a TV remote: `xxxx-xxxx-xxxx-xxxx-xxxx-xxxx`.
 * Because it is random, a plain SHA-256 is an adequate storage hash and avoids PBKDF2's CPU cost on the free plan.
 */
export function generateAppPassword(): string {
	// Rejection sampling keeps every character uniformly likely.
	const limit = 256 - (256 % PASSWORD_ALPHABET.length);
	const chars: string[] = [];
	while (chars.length < 24) {
		for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
			if (byte < limit && chars.length < 24) chars.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
		}
	}
	return Array.from({ length: 6 }, (_, group) => chars.slice(group * 4, group * 4 + 4).join('')).join(
		'-'
	);
}

export async function sha256Hex(value: string): Promise<string> {
	return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** Deterministic 32-char lowercase hex id, the format Jellyfin clients parse as a GUID. */
export async function guid(value: string): Promise<string> {
	return (await sha256Hex(value)).slice(0, 32);
}

/** Short stable tag used for image cache busting. */
export async function shortHash(value: string): Promise<string> {
	return (await sha256Hex(value)).slice(0, 16);
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function aesKey(secret: string): Promise<CryptoKey> {
	let key = keyCache.get(secret);
	if (!key) {
		key = crypto.subtle
			.digest('SHA-256', encoder.encode(secret))
			.then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
		keyCache.set(secret, key);
	}
	return key;
}

export async function encrypt(secret: string, plaintext: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await aesKey(secret),
		encoder.encode(plaintext)
	);
	const out = new Uint8Array(iv.length + ciphertext.byteLength);
	out.set(iv);
	out.set(new Uint8Array(ciphertext), iv.length);
	return toBase64(out);
}

export async function decrypt(secret: string, payload: string): Promise<string> {
	const bytes = fromBase64(payload);
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: bytes.subarray(0, 12) },
		await aesKey(secret),
		bytes.subarray(12)
	);
	return decoder.decode(plaintext);
}
