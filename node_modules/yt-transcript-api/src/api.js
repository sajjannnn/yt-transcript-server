const { TranscriptListFetcher } = require('./transcripts');
const { ProxyConfig, GenericProxyConfig } = require('./proxies');
const axios = require('axios');

class YouTubeTranscriptApi {
   constructor({ proxyConfig = null, httpClient = null } = {}) {
      // Use axios for HTTP requests
      this.httpClient = httpClient || axios.create();
      this.httpClient.defaults.headers['Accept-Language'] = 'en-US';

      // Proxy support (basic, for demonstration)
      if (proxyConfig) {
         // You may need to use a proxy agent for axios in real usage
         // This is a placeholder for proxy config
         this.proxyConfig = proxyConfig;
      } else {
         this.proxyConfig = null;
      }

      this.fetcher = new TranscriptListFetcher(this.httpClient, this.proxyConfig);
   }

   async fetch(videoId, languages = ['en'], preserveFormatting = false) {
      // Retrieves the transcript for a single video.
      const transcriptList = await this.list(videoId);
      const transcript = transcriptList.findTranscript(languages);
      return transcript.fetch(preserveFormatting);
   }

   async list(videoId) {
      // Retrieves the list of transcripts which are available for a given video.
      return await this.fetcher.fetch(videoId);
   }

   // Deprecated: use list instead
   static async listTranscripts(videoId, proxies = null) {
      console.warn(
         "`listTranscripts` is deprecated and will be removed in a future version. Use the `list` method instead!"
      );

      let proxyConfig = null;
      if (proxies) {
         if (proxies instanceof ProxyConfig) {
            proxyConfig = proxies;
         } else {
            proxyConfig = new GenericProxyConfig(
               proxies.http || null,
               proxies.https || null
            );
         }
      }

      const api = new YouTubeTranscriptApi({ proxyConfig });
      return await api.list(videoId);
   }

   // Deprecated: use fetch instead
   static async getTranscripts(
      videoIds,
      languages = ['en'],
      continueAfterError = false,
      proxies = null,
      preserveFormatting = false
   ) {
      console.warn(
         "`getTranscripts` is deprecated and will be removed in a future version. Use the `fetch` method instead!"
      );

      if (!Array.isArray(videoIds)) {
         throw new Error("`videoIds` must be a list of strings");
      }

      const data = {};
      const unretrievableVideos = [];

      for (const videoId of videoIds) {
         try {
            data[videoId] = await YouTubeTranscriptApi.getTranscript(
               videoId, languages, proxies, preserveFormatting
            );
         } catch (e) {
            if (!continueAfterError) throw e;
            unretrievableVideos.push(videoId);
         }
      }

      return [data, unretrievableVideos];
   }

   // Deprecated: use fetch instead
   static async getTranscript(
      videoId,
      languages = ['en'],
      proxies = null,
      preserveFormatting = false
   ) {
      console.warn(
         "`getTranscript` is deprecated and will be removed in a future version. Use the `fetch` method instead!"
      );

      if (typeof videoId !== 'string') {
         throw new Error("`videoId` must be a string");
      }

      const transcriptList = await YouTubeTranscriptApi.listTranscripts(videoId, proxies);
      const transcript = transcriptList.findTranscript(languages);
      const fetched = await transcript.fetch(preserveFormatting);
      return fetched.toRawData();
   }
}

module.exports = YouTubeTranscriptApi;