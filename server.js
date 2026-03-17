const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY || "YOUR_API_KEY";

async function getVideoMetadata(videoId) {
  try {
    const response = await axios.get(
      `https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`,
      { timeout: 10000 }
    );
    
    const oembed = response.data;
    
    const detailsResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,snippet&key=${process.env.YOUTUBE_API_KEY}`,
      { timeout: 10000 }
    );
    
    let duration = null;
    let language = null;
    
    if (detailsResponse.data.items && detailsResponse.data.items.length > 0) {
      const item = detailsResponse.data.items[0];
      duration = item.contentDetails.duration;
      language = item.snippet.defaultLanguage || item.snippet.language || null;
    }
    
    return {
      title: oembed.title,
      author: oembed.author_name,
      duration,
      language,
      available: true
    };
  } catch (error) {
    return {
      title: null,
      author: null,
      duration: null,
      language: null,
      available: false,
      error: error.message
    };
  }
}

async function getTranscript(videoId) {
  const response = await axios.get(
    `https://api.supadata.ai/v1/transcript?url=https://youtu.be/${videoId}`,
    {
      headers: {
        "x-api-key": SUPADATA_API_KEY,
      },
      timeout: 30000,
    }
  );
  
  return response.data.content;
}

app.get("/captions/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    const [metadata, transcript] = await Promise.all([
      getVideoMetadata(videoId),
      getTranscript(videoId).catch(err => null)
    ]);

    if (!transcript) {
      return res.json({
        success: true,
        captionsAvailable: false,
        message: "Captions not available for this video",
        metadata: {
          title: metadata.title,
          duration: metadata.duration,
          language: metadata.language,
          author: metadata.author
        },
        overviewNote: "This is not a proper summary of the video. It is just an overview of the topic mentioned in the video.",
        transcript: []
      });
    }

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

    res.json({
      success: true,
      captionsAvailable: true,
      metadata: {
        title: metadata.title,
        duration: metadata.duration,
        language: metadata.language,
        author: metadata.author
      },
      transcript: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
