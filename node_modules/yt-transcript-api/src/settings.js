const WATCH_URL = "https://www.youtube.com/watch?v={video_id}";
const INNERTUBE_API_URL = "https://www.youtube.com/youtubei/v1/player?key={api_key}";
const INNERTUBE_CONTEXT = { client: { clientName: "ANDROID", clientVersion: "20.10.38" } };

module.exports = {
   WATCH_URL,
   INNERTUBE_API_URL,
   INNERTUBE_CONTEXT
};