# Client checklist

Run through this list with each client after changes to the Jellyfin API.

| Step                                                  | Infuse | Swiftfin | Findroid | Jellyfin Web |
| ----------------------------------------------------- | ------ | -------- | -------- | ------------ |
| Add server and sign in with an app password           |        |          |          |              |
| Libraries appear in dashboard order                   |        |          |          |              |
| Scrolling a library loads further pages               |        |          |          |              |
| Series → season → episode navigation                  |        |          |          |              |
| Posters and backdrops load                            |        |          |          |              |
| Movie plays (first source)                            |        |          |          |              |
| Choosing another source plays it                      |        |          |          |              |
| Episode plays                                         |        |          |          |              |
| Search finds movies and series                        |        |          |          |              |
| Continue Watching shows a paused item (scrobbling on) |        |          |          |              |
| Next Up shows the next episode (scrobbling on)        |        |          |          |              |
| Marking played updates the provider                   |        |          |          |              |

Known limitations:

- Jellyfin Web plays in the browser, so MKV and HEVC sources may not play there. Native clients play them.
- Items without an IMDb or TMDB id (for example Kitsu anime ids) play but are not scrobbled.
- Streams that need custom request headers are hidden because the server only redirects to sources.
