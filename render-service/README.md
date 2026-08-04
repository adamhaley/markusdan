# Risk Fast Check Render Service

Small HTTP service for rendering the resolver's canonical video sequence with Vimeo clips and FFmpeg.

## Request

`POST /render`

```json
{
  "sequence": [
    { "type": "answer", "order": 1, "label": "RSCL_A1c_100k-500k", "videoId": "1206983457" },
    { "type": "pitch", "order": 7, "label": "RSCL_Pitch_C_Everything_Else", "videoId": "1207155801" }
  ],
  "metadata": {
    "pitchKey": "pitch_c_everything_else",
    "normalizedAnswers": { "1": "1c", "2": "2a" }
  }
}
```

The service downloads the Vimeo files, normalizes them to a common 1280x720/30fps format, and joins them using a short `xfade`/`acrossfade` transition. The response contains a deterministic cached URL:

```json
{
  "ok": true,
  "renderId": "...",
  "videoUrl": "https://renders.megyk.com/renders/....mp4",
  "cached": false
}
```

Set `RENDER_API_KEY` in production and send it as `x-render-api-key`. Set `VIMEO_ACCESS_TOKEN` to a Vimeo personal access token with permission to read the source videos and their downloadable files.

## Local run

```bash
cp .env.example .env
npm install
node server.js
```

The service requires `ffmpeg` and `ffprobe` on the host. The included Dockerfile installs both.
