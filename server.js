const express = require("express");
const cors = require("cors");
const { YouTubeTranscriptApi } = require("yt-transcript-api");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;


app.get("/captions/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    const api = new YouTubeTranscriptApi();

    const transcript = await api.fetch(videoId, ["en", "hi"]);

   let currentMinute = 0;
let block = [];
const result = [];

for (const item of transcript) {

  if (item.start < (currentMinute + 1) * 60) {
    block.push(item.text);
  } else {

    result.push({
      minute: currentMinute,
      text: block.join(" ")
    });

    block = [item.text];
    currentMinute++;
  }
}

if (block.length > 0) {
  result.push({
    minute: currentMinute,
    text: block.join(" ")
  });
}

res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
