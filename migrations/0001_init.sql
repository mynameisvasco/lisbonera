CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE addons (
	id TEXT PRIMARY KEY,
	url TEXT NOT NULL UNIQUE,
	manifest TEXT,
	enabled INTEGER NOT NULL DEFAULT 1,
	position INTEGER NOT NULL,
	last_error TEXT,
	checked_at INTEGER
);

CREATE TABLE libraries (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('catalog', 'collection')),
	addon_id TEXT REFERENCES addons (id) ON DELETE CASCADE,
	catalog_type TEXT NOT NULL CHECK (catalog_type IN ('movie', 'series', 'mixed')),
	catalog_id TEXT,
	name TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 1,
	position INTEGER NOT NULL,
	UNIQUE (addon_id, catalog_type, catalog_id)
);

CREATE TABLE collection_items (
	library_id TEXT NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
	stremio_type TEXT NOT NULL CHECK (stremio_type IN ('movie', 'series')),
	stremio_id TEXT NOT NULL,
	name TEXT NOT NULL,
	poster TEXT,
	position INTEGER NOT NULL,
	PRIMARY KEY (library_id, stremio_id)
);

CREATE TABLE app_passwords (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	last_used_at INTEGER
);

CREATE TABLE sessions (
	token_hash TEXT PRIMARY KEY,
	app_password_id TEXT NOT NULL REFERENCES app_passwords (id) ON DELETE CASCADE,
	client TEXT NOT NULL,
	device TEXT NOT NULL,
	device_id TEXT NOT NULL,
	version TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL
);

CREATE INDEX sessions_app_password ON sessions (app_password_id);

CREATE TABLE id_map (
	guid TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'season', 'episode')),
	stremio_id TEXT NOT NULL,
	season INTEGER,
	episode INTEGER,
	video_id TEXT,
	name TEXT,
	poster TEXT,
	background TEXT,
	logo TEXT,
	runtime_ticks INTEGER
);

CREATE TABLE scrobble_accounts (
	provider TEXT PRIMARY KEY,
	tokens TEXT NOT NULL,
	username TEXT,
	active INTEGER NOT NULL DEFAULT 0,
	last_error TEXT,
	updated_at INTEGER NOT NULL
);

CREATE TABLE display_prefs (
	id TEXT NOT NULL,
	client TEXT NOT NULL,
	data TEXT NOT NULL,
	PRIMARY KEY (id, client)
);

INSERT INTO addons (id, url, enabled, position)
VALUES ('cinemeta', 'https://v3-cinemeta.strem.io', 1, 0);
