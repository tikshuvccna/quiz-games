# Video library

Videos the teacher can show in the lobby while players join (**Room settings → 🎬 סרטון בזמן ההמתנה**).

- **Local files** (`.mp4`, `.webm`) in this folder: they work without internet.
- **YouTube**: list them in `videos.json` (title + link). For the Google Flow videos uploaded to YouTube, add one line each:

```json
[
  { "title": "פתיח החידון", "youtube": "https://youtu.be/XXXXXXXXXXX" },
  { "title": "הסבר המשחק", "youtube": "https://www.youtube.com/watch?v=XXXXXXXXXXX" }
]
```
