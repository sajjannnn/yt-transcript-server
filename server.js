const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY || "YOUR_API_KEY";

async function getTranscript(videoId) {
  const response = await axios.get(`https://api.supadata.ai/v1/transcript?url=https://youtu.be/${videoId}`, {
    headers: {
      "x-api-key": SUPADATA_API_KEY,
    },
    timeout: 30000,
  });

  return response.data.content;
}

app.get("/captions/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    const transcript = await getTranscript(videoId);

    let currentMinute = 0;
    let block = [];
    const result = [];

    for (const item of transcript) {
      const itemMinute = Math.floor(item.offset / 60000);

      if (itemMinute === currentMinute) {
        block.push(item.text);
      } else {
        result.push({
          minute: currentMinute,
          text: block.join(" "),
        });

        block = [item.text];
        currentMinute = itemMinute;
      }
    }

    if (block.length > 0) {
      result.push({
        minute: currentMinute,
        text: block.join(" "),
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
