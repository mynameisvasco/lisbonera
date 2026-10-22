-- Collections can follow sources (an addon catalog filtered by genre, MDBList or Trakt lists) instead of a
-- hand-picked title list, and any library can carry its own artwork.
ALTER TABLE libraries ADD COLUMN sources TEXT;
ALTER TABLE libraries ADD COLUMN image TEXT;
ALTER TABLE libraries ADD COLUMN image_aspect REAL;

-- Uploaded artwork. Small enough for D1 (the dashboard resizes before uploading).
CREATE TABLE images (
	id TEXT PRIMARY KEY,
	content_type TEXT NOT NULL,
	data BLOB NOT NULL,
	created_at INTEGER NOT NULL
);
