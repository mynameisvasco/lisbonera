import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function teamOrigin(teamDomain: string): string {
	const host = teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	return `https://${host}`;
}

function jwks(teamDomain: string) {
	let set = jwksByTeam.get(teamDomain);
	if (!set) {
		set = createRemoteJWKSet(new URL(`${teamOrigin(teamDomain)}/cdn-cgi/access/certs`));
		jwksByTeam.set(teamDomain, set);
	}
	return set;
}

export type AccessConfig = Pick<Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD' | 'ADMIN_EMAIL'>;

/**
 * Verifies the Cloudflare Access JWT. Access already blocks unauthenticated requests at the edge; this check stops
 * requests that reach the Worker another way (e.g. the workers.dev URL) and pins the allowed email.
 */
export async function verifyAccess(
	request: Request,
	config: AccessConfig
): Promise<{ email: string } | null> {
	const token = request.headers.get('cf-access-jwt-assertion');
	if (!token || !config.ACCESS_TEAM_DOMAIN || !config.ACCESS_AUD || !config.ADMIN_EMAIL)
		return null;
	try {
		const { payload } = await jwtVerify(token, jwks(config.ACCESS_TEAM_DOMAIN), {
			issuer: teamOrigin(config.ACCESS_TEAM_DOMAIN),
			audience: config.ACCESS_AUD
		});
		const email = typeof payload.email === 'string' ? payload.email : null;
		const allowed = config.ADMIN_EMAIL.split(',').map((value) => value.trim().toLowerCase());
		return email && allowed.includes(email.toLowerCase()) ? { email } : null;
	} catch {
		return null;
	}
}
